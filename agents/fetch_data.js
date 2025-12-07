const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const API_KEY = process.env.API_FOOTBALL_KEY;
const DAYS_AHEAD = 2; // danas + 2 dana unapred
const ALLOWED_LEAGUES = [39, 140, 135, 3, 14, 2, 848, 38, 78, 79, 61, 62, 218, 88, 89, 203, 40, 119, 136, 736, 207];
const MIN_ODD = 1.1;
const MAX_ODD = 1.45;
const CACHE_DIR = path.join(__dirname, '..', 'data', 'cache');
const MATCHES_OUTPUT = path.join(__dirname, '..', 'data', 'matches.json');

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
      console.warn(
        `Request failed (attempt ${attempt + 1}/${retries + 1}): ${error.message}. Retrying in ${delay}ms.`
      );
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

async function ensureCacheDir() {
  await fs.mkdir(CACHE_DIR, { recursive: true });
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
    status: raw.fixture.status?.short || null,
    date: raw.fixture.date,
    timestamp: raw.fixture.timestamp,
    homeTeam: raw.teams.home.name,
    awayTeam: raw.teams.away.name,
    goalsHome: parseNumber(raw.goals?.home),
    goalsAway: parseNumber(raw.goals?.away),
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
  const { data } = await withRetry(() =>
    client.get('/fixtures', {
      params: {
        date,
        timezone: 'Europe/Belgrade',
      },
    })
  );

  await fs.writeFile(path.join(CACHE_DIR, `fixtures-${date}.raw.json`), JSON.stringify(data, null, 2), 'utf-8');
  const fixtures = data?.response || [];
  return fixtures
    .filter((item) => ALLOWED_LEAGUES.includes(item.league?.id))
    .map(normalizeFixture);
}

async function fetchOddsForDate(date) {
  const { data } = await withRetry(() =>
    client.get('/odds', {
      params: {
        date,
        timezone: 'Europe/Belgrade',
      },
    })
  );

  await fs.writeFile(path.join(CACHE_DIR, `odds-${date}.raw.json`), JSON.stringify(data, null, 2), 'utf-8');

  const oddsMap = new Map();
  const oddsResponse = data?.response || [];

  oddsResponse.forEach((entry) => {
    const fixtureId = entry.fixture?.id;
    if (!fixtureId) return;
    const normalized = normalizeOddsEntry(entry);
    if (normalized) {
      oddsMap.set(String(fixtureId), normalized);
    }
  });

  return oddsMap;
}

function mergeFixturesAndOdds(fixtures, oddsMap) {
  return fixtures
    .map((f) => {
      const odds = oddsMap.get ? oddsMap.get(String(f.fixtureId)) : oddsMap[f.fixtureId];
      return { ...f, odds: odds || null };
    })
    .filter((f) => f.odds);
}

function isValidFixture(match) {
  if (!match.fixtureId || !match.leagueId) return false;
  if (!match.homeTeam || !match.awayTeam) return false;
  if (!match.date || !match.timestamp) return false;
  return true;
}

function oddsWithinRange(match) {
  const { odds } = match;
  const values = odds?.matchWinner
    ? [odds.matchWinner.home, odds.matchWinner.draw, odds.matchWinner.away]
        .filter((value) => typeof value === 'number')
    : [];

  if (!values.length) return false;
  return values.some((value) => value >= MIN_ODD && value <= MAX_ODD);
}

async function main() {
  console.log('Fetching fixtures and odds');
  await ensureCacheDir();

  try {
    const allMatches = [];

    for (let offset = 0; offset <= DAYS_AHEAD; offset += 1) {
      const date = getDateYYYYMMDD(offset);
      console.log(`Processing date: ${date}`);
      const fixtures = await fetchFixturesForDate(date);
      const oddsMap = await fetchOddsForDate(date);
      const merged = mergeFixturesAndOdds(fixtures, oddsMap)
        .filter(isValidFixture)
        .filter(oddsWithinRange);

      allMatches.push(...merged);
    }

    await fs.writeFile(MATCHES_OUTPUT, JSON.stringify(allMatches, null, 2), 'utf-8');
    console.log(`Saved ${allMatches.length} fixtures to ${MATCHES_OUTPUT}`);
  } catch (error) {
    console.error('Failed to fetch fixtures or odds:', error.message);
    process.exit(1);
  }
}

main();
