const fs = require('fs');
const path = require('path');

const matchesPath = path.join(__dirname, '..', 'data', 'matches.json');
const predictionsPath = path.join(__dirname, '..', 'data', 'predictions.json');
const evaluationPath = path.join(__dirname, '..', 'data', 'evaluation.json');

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse JSON from ${filePath}:`, error.message);
    process.exit(1);
  }
}

const matches = readJson(matchesPath);
const predictions = readJson(predictionsPath);

const fixtureMap = new Map();
matches.forEach((match) => {
  if (match.fixtureId !== undefined && match.fixtureId !== null) {
    fixtureMap.set(match.fixtureId, match);
  }
});

const items = [];

predictions.forEach((prediction) => {
  const match = fixtureMap.get(prediction.fixtureId);

  if (!match) {
    console.warn(`No match found for fixtureId ${prediction.fixtureId}`);
    return;
  }

  const homeGoals = typeof match.goalsHome === 'number' ? match.goalsHome : 0;
  const awayGoals = typeof match.goalsAway === 'number' ? match.goalsAway : 0;
  const resultStr = `${homeGoals}:${awayGoals}`;

  let hit = false;
  if (prediction.market === 'OVER_1_5') {
    hit = homeGoals + awayGoals >= 2;
  } else if (prediction.market === 'BTTS_YES') {
    hit = homeGoals > 0 && awayGoals > 0;
  }

  items.push({
    fixtureId: prediction.fixtureId,
    league: prediction.league,
    country: prediction.country,
    homeTeam: prediction.homeTeam,
    awayTeam: prediction.awayTeam,
    market: prediction.market,
    odd: prediction.odd,
    confidence: prediction.confidence,
    hit,
    result: resultStr,
  });
});

const totalPredictions = items.length;
const hits = items.filter((item) => item.hit).length;
const misses = totalPredictions - hits;
const hitRate = totalPredictions > 0 ? Number(((hits / totalPredictions) * 100).toFixed(2)) : 0;

const now = new Date();
const evaluation = {
  date: now.toISOString().slice(0, 10),
  generatedAt: now.toISOString(),
  totalPredictions,
  hits,
  misses,
  hitRate,
  items,
};

fs.writeFileSync(evaluationPath, `${JSON.stringify(evaluation, null, 2)}\n`);
console.log(`Evaluation saved to ${evaluationPath}`);
