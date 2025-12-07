const axios = require('axios');
const fs = require('fs/promises');
const path = require('path');

const API_KEY = process.env.API_FOOTBALL_KEY;
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'matches.json');

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

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isMajorLeague(league) {
  if (!league) return false;
  const majorTypes = new Set(['League', 'Cup']);
  const excludedCountries = new Set(['World', 'International']);
  return majorTypes.has(league.type) && !excludedCountries.has(league.country);
}

function mapFixture(fixture) {
  return {
    fixtureId: fixture.fixture.id,
    date: fixture.fixture.date,
    status: fixture.fixture.status?.short || null,
    leagueId: fixture.league.id,
    league: fixture.league.name,
    country: fixture.league.country,
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    odds: null,
  };
}

function extractMatchOdds(oddsResponse) {
  const bookmaker = oddsResponse?.bookmakers?.[0];
  const matchWinnerBet = bookmaker?.bets?.find((bet) => bet.name === 'Match Winner');
  const values = matchWinnerBet?.values || [];
  const odds = values.reduce(
    (acc, value) => {
      if (value.value === 'Home') acc.home = Number(value.odd) || null;
      if (value.value === 'Draw') acc.draw = Number(value.odd) || null;
      if (value.value === 'Away') acc.away = Number(value.odd) || null;
      return acc;
    },
    { home: null, draw: null, away: null }
  );
  if (!odds.home && !odds.draw && !odds.away) return null;
  return odds;
}

async function fetchFixtures(date) {
  const { data } = await withRetry(() =>
    client.get('/fixtures', {
      params: {
        date,
        timezone: 'UTC',
      },
    })
  );
  return data?.response || [];
}

async function fetchOddsForFixture(fixtureId) {
  const { data } = await withRetry(() =>
    client.get('/odds', {
      params: { fixture: fixtureId },
    })
  );
  return data?.response?.[0] || null;
}

async function main() {
  console.log('Fetching fixtures for', today());
  try {
    const fixtures = await fetchFixtures(today());
    const filtered = fixtures.filter((fixture) => isMajorLeague(fixture.league));
    const mapped = filtered.map(mapFixture);

    const withOdds = await Promise.all(
      mapped.map(async (match) => {
        try {
          const oddsResponse = await fetchOddsForFixture(match.fixtureId);
          const odds = extractMatchOdds(oddsResponse);
          if (!odds) {
            console.warn(`No odds found for fixture ${match.fixtureId}. Keeping odds as null.`);
          }
          return { ...match, odds };
        } catch (error) {
          console.warn(`Odds fetch failed for fixture ${match.fixtureId}:`, error.message);
          return match;
        }
      })
    );

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(withOdds, null, 2), 'utf-8');
    console.log(`Saved ${withOdds.length} fixtures to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Failed to fetch fixtures or odds:', error.message);
    process.exit(1);
  }
}

main();
