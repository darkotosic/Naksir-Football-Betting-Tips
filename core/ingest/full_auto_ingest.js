const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const API_KEY = process.env.API_FOOTBALL_KEY;
const DAYS_AHEAD = Number(process.env.DAYS_AHEAD || 2);
const ALLOWED_LEAGUES = [39, 140, 135, 3, 14, 2, 848, 38, 78, 79, 61, 62, 218, 88, 89, 203, 40, 119, 136, 736, 207];
const CACHE_ROOT = path.join(__dirname, '..', '..', 'cache');

if (!API_KEY) {
  console.error('Missing API_FOOTBALL_KEY environment variable.');
  process.exit(1);
}

const client = axios.create({
  baseURL: 'https://v3.football.api-sports.io',
  headers: {
    'x-apisports-key': API_KEY,
  },
  timeout: 15000,
});

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries = 2, baseDelay = 500 } = {}) {
  let attempt = 0;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;

      const delay = baseDelay * (attempt + 1);
      console.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}): ${error.message}. Retrying in ${delay}ms.`);
      await wait(delay);
      attempt += 1;
    }
  }

  throw lastError;
}

function getDateYYYYMMDD(offsetDays = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function writeJson(target, data) {
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, JSON.stringify(data, null, 2), 'utf-8');
}

async function readCachedJson(target) {
  try {
    const content = await fs.readFile(target, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function parseNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeFixture(raw) {
  return {
    fixtureId: raw.fixture.id,
    leagueId: raw.league.id,
    league: raw.league.name,
    country: raw.league.country,
    season: raw.league.season,
    status: raw.fixture.status?.short || null,
    date: raw.fixture.date,
    timestamp: raw.fixture.timestamp,
    homeTeam: raw.teams.home,
    awayTeam: raw.teams.away,
  };
}

function parseMatchWinner(bets) {
  const bet = bets.find((b) => b.name === 'Match Winner');
  const matchWinner = {
    home: parseNumber(bet?.values?.find((v) => v.value === 'Home')?.odd),
    draw: parseNumber(bet?.values?.find((v) => v.value === 'Draw')?.odd),
    away: parseNumber(bet?.values?.find((v) => v.value === 'Away')?.odd),
  };

  if (!matchWinner.home && !matchWinner.draw && !matchWinner.away) return null;
  return matchWinner;
}

function parseOverUnder(bets, label, line) {
  const bet = bets.find((b) => b.name === 'Over/Under');
  const home = parseNumber(bet?.values?.find((v) => v.value === label)?.odd);
  if (!home) return null;
  return { home, line };
}

function parseBTTS(bets) {
  const bet = bets.find((b) => b.name === 'Both Teams To Score');
  const yes = parseNumber(bet?.values?.find((v) => v.value === 'Yes')?.odd);
  const no = parseNumber(bet?.values?.find((v) => v.value === 'No')?.odd);
  if (!yes && !no) return null;
  return { yes, no };
}

function normalizeOddsEntry(entry) {
  const bookmaker = entry?.bookmakers?.[0];
  const bets = bookmaker?.bets || [];

  const matchWinner = parseMatchWinner(bets);
  const over15 = parseOverUnder(bets, 'Over 1.5', 1.5);
  const over25 = parseOverUnder(bets, 'Over 2.5', 2.5);
  const btts = parseBTTS(bets);

  if (!matchWinner && !over15 && !over25 && !btts) return null;
  return { matchWinner, over15, over25, btts };
}

async function fetchFixturesForDate(date) {
  const cached = await readCachedJson(path.join(CACHE_ROOT, date, 'fixtures.json'));
  if (cached) return cached;

  const { data } = await withRetry(() =>
    client.get('/fixtures', {
      params: {
        date,
        timezone: 'Europe/Belgrade',
      },
    })
  );

  const fixtures = (data?.response || [])
    .filter((item) => ALLOWED_LEAGUES.includes(item.league?.id))
    .map(normalizeFixture);

  await writeJson(path.join(CACHE_ROOT, date, 'fixtures.json'), fixtures);
  return fixtures;
}

async function fetchOddsForDate(date) {
  const cached = await readCachedJson(path.join(CACHE_ROOT, date, 'odds.json'));
  if (cached) return cached;

  const { data } = await withRetry(() =>
    client.get('/odds', {
      params: {
        date,
        timezone: 'Europe/Belgrade',
      },
    })
  );

  const oddsMap = {};
  const oddsResponse = data?.response || [];

  oddsResponse.forEach((entry) => {
    const fixtureId = entry.fixture?.id;
    if (!fixtureId) return;
    const normalized = normalizeOddsEntry(entry);
    if (normalized) {
      oddsMap[String(fixtureId)] = normalized;
    }
  });

  await writeJson(path.join(CACHE_ROOT, date, 'odds.json'), oddsMap);
  return oddsMap;
}

async function fetchStandings(leagueId, season, date) {
  const target = path.join(CACHE_ROOT, date, 'standings.json');
  const cached = await readCachedJson(target);
  if (cached?.[leagueId]) return cached;

  const current = cached || {};
  const { data } = await withRetry(() =>
    client.get('/standings', {
      params: {
        league: leagueId,
        season,
      },
    })
  );

  current[leagueId] = data?.response?.[0]?.league?.standings || [];
  await writeJson(target, current);
  return current;
}

async function fetchTeamStats(teamId, leagueId, season, date) {
  const target = path.join(CACHE_ROOT, date, 'stats', `${teamId}.json`);
  const cached = await readCachedJson(target);
  if (cached) return cached;

  const { data } = await withRetry(() =>
    client.get('/teams/statistics', {
      params: {
        team: teamId,
        league: leagueId,
        season,
      },
    })
  );

  const stats = data?.response || {};
  await writeJson(target, stats);
  return stats;
}

async function fetchH2H(homeId, awayId, fixtureId, date) {
  const target = path.join(CACHE_ROOT, date, 'h2h', `${fixtureId}.json`);
  const cached = await readCachedJson(target);
  if (cached) return cached;

  const { data } = await withRetry(() =>
    client.get('/fixtures/headtohead', {
      params: {
        h2h: `${homeId}-${awayId}`,
      },
    })
  );

  const history = data?.response || [];
  await writeJson(target, history);
  return history;
}

function isValidFixture(match) {
  if (!match.fixtureId || !match.leagueId) return false;
  if (!match.homeTeam?.id || !match.awayTeam?.id) return false;
  if (!match.date || !match.timestamp) return false;
  return true;
}

async function buildCacheForDate(date) {
  const fixtures = await fetchFixturesForDate(date);
  const odds = await fetchOddsForDate(date);
  const filtered = fixtures.filter(isValidFixture);

  for (const match of filtered) {
    await fetchStandings(match.leagueId, match.season, date);
    await fetchTeamStats(match.homeTeam.id, match.leagueId, match.season, date);
    await fetchTeamStats(match.awayTeam.id, match.leagueId, match.season, date);
    await fetchH2H(match.homeTeam.id, match.awayTeam.id, match.fixtureId, date);
  }

  const merged = filtered
    .map((fixture) => ({
      ...fixture,
      odds: odds[String(fixture.fixtureId)] || null,
    }))
    .filter((item) => item.odds);

  await writeJson(path.join(CACHE_ROOT, date, 'merged.json'), merged);
  console.log(`Cached ${merged.length} fixtures with odds for ${date}`);
  return merged;
}

async function fetchAllData(daysAhead = DAYS_AHEAD) {
  console.log(`Full auto ingest starting for ${daysAhead + 1} day window.`);
  const results = [];
  for (let offset = 0; offset <= daysAhead; offset += 1) {
    const date = getDateYYYYMMDD(offset);
    results.push(await buildCacheForDate(date));
  }
  console.log('Full auto ingest completed.');
  return results.flat();
}

if (require.main === module) {
  fetchAllData().catch((error) => {
    console.error('Full auto ingest failed:', error.message);
    process.exit(1);
  });
}

module.exports = { fetchAllData };
