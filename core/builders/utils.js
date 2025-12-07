function createBuilderLeg(match, market, odd, meta = {}) {
  if (!match || !match.fixtureId || !match.leagueId || !match.homeTeam || !match.awayTeam) {
    return null;
  }

  if (typeof odd !== 'number' || Number.isNaN(odd)) {
    return null;
  }

  return {
    fixture_id: match.fixtureId,
    league_id: match.leagueId,
    team_home: match.homeTeam?.name || match.homeTeam,
    team_away: match.awayTeam?.name || match.awayTeam,
    market,
    odd,
    confidence: 0,
    meta: {
      statsAvailable: Boolean(meta.statsAvailable ?? match.statsAvailable ?? true),
      leagueWeight: meta.leagueWeight || 1,
      family: meta.family || market.replace(/[^A-Z]/gi, '').slice(0, 3).toUpperCase(),
    },
  };
}

module.exports = { createBuilderLeg };
