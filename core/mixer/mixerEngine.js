const { applyRules } = require('./ruleEngine');
const { scoreLegs } = require('../ai/metaModel');

function generateCombinations(legs, targetCount = 50, legPerTicket = 3) {
  const combos = [];
  for (let i = 0; i < legs.length && combos.length < targetCount; i += 1) {
    for (let j = i + 1; j < legs.length && combos.length < targetCount; j += 1) {
      for (let k = j + 1; k < legs.length && combos.length < targetCount; k += 1) {
        const combo = [legs[i], legs[j], legs[k]];
        if (combo.length === legPerTicket) {
          combos.push(combo);
        }
      }
    }
  }
  return combos;
}

function scoreTicket(legs) {
  const totalOdd = legs.reduce((sum, leg) => sum * (leg.odd || 1), 1);
  const confidenceAvg = Math.round(legs.reduce((sum, leg) => sum + (leg.confidence || 0), 0) / legs.length);
  return {
    id: `TKT-${new Date().toISOString().slice(0, 10)}-${Math.random().toString(16).slice(2, 6)}`,
    date: new Date().toISOString(),
    total_odd: Number(totalOdd.toFixed(2)),
    confidence_avg: confidenceAvg,
    legs,
    summary: `Auto-mixed ticket with ${legs.length} legs`,
    meta: {
      leg_count: legs.length,
    },
  };
}

function mixAndRank(legs) {
  const filtered = applyRules(legs);
  const scoredLegs = scoreLegs(filtered, (leg) => ({
    form: leg.meta?.leagueWeight * 10,
    xG: leg.meta?.leagueWeight * 8,
    shots: 5,
    momentum: 6,
    h2h: 4,
  }));

  const combos = generateCombinations(scoredLegs, 60);
  const tickets = combos.map((combo) => scoreTicket(combo)).sort((a, b) => b.confidence_avg - a.confidence_avg);
  return tickets.slice(0, 3);
}

module.exports = { mixAndRank };
