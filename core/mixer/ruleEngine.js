const TOP_LEAGUES = [39, 140, 135, 78, 61];

function withinOddsRange(leg) {
  return leg.odd >= 1.08 && leg.odd <= 1.5;
}

function hasStats(leg) {
  return leg.meta?.statsAvailable !== false;
}

function leagueWeight(leg) {
  return TOP_LEAGUES.includes(leg.league_id) ? 1.25 : 1;
}

function applyRules(legs) {
  const families = new Map();
  const leagues = new Map();

  return legs
    .filter(withinOddsRange)
    .filter(hasStats)
    .sort((a, b) => leagueWeight(b) - leagueWeight(a))
    .filter((leg) => {
      const family = leg.meta?.family || leg.market;
      const league = leg.league_id;

      const familyCount = families.get(family) || 0;
      if (familyCount >= 2) return false;

      const leagueCount = leagues.get(league) || 0;
      if (leagueCount >= 2) return false;

      families.set(family, familyCount + 1);
      leagues.set(league, leagueCount + 1);
      return true;
    })
    .map((leg) => ({
      ...leg,
      meta: {
        ...leg.meta,
        leagueWeight: leagueWeight(leg),
      },
    }));
}

module.exports = { applyRules };
