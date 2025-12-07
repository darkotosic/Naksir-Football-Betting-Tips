const fs = require('fs/promises');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'outputs', 'evaluation.json');
const RESULTS_FILE = path.join(__dirname, '..', 'data', 'results.json');

async function fetchResults() {
  try {
    const content = await fs.readFile(RESULTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

async function loadEvaluation() {
  try {
    const content = await fs.readFile(OUTPUT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return { history: [], streak: 0 };
  }
}

function evaluateTickets(results, evaluation) {
  const today = new Date().toISOString().slice(0, 10);
  const dayResults = results.filter((r) => r.date?.startsWith(today));
  const wins = dayResults.filter((r) => r.win).length;
  const losses = dayResults.length - wins;
  const streak = wins === dayResults.length ? evaluation.streak + 1 : 0;

  evaluation.history.push({ date: today, wins, losses });
  evaluation.streak = streak;
  return evaluation;
}

async function main() {
  const results = await fetchResults();
  const evaluation = await loadEvaluation();
  const updated = evaluateTickets(results, evaluation);
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  console.log('Evaluation updated');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Evaluation failed', error.message);
    process.exit(1);
  });
}

module.exports = { evaluateTickets };
