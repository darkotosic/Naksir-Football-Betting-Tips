const fs = require('fs/promises');
const path = require('path');
const { runBuilders } = require('../core/builders/registry');
const { mixAndRank } = require('../core/mixer/mixerEngine');

const CACHE_ROOT = path.join(__dirname, '..', 'cache');
const OUTPUT_FILE = path.join(__dirname, 'tickets.json');

async function readMergedForDate(date) {
  const target = path.join(CACHE_ROOT, date, 'merged.json');
  try {
    const content = await fs.readFile(target, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return [];
  }
}

async function listDates() {
  try {
    const entries = await fs.readdir(CACHE_ROOT, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  } catch (error) {
    return [];
  }
}

async function buildTickets() {
  const dates = await listDates();
  const fixtures = (await Promise.all(dates.map(readMergedForDate))).flat();

  const legs = runBuilders(fixtures);
  const tickets = mixAndRank(legs);

  const telegram = tickets.map((ticket) => ({
    ...ticket,
    tag: `#${ticket.legs.map((leg) => leg.market).join('_')}`,
    emoji: ticket.confidence_avg > 75 ? '🟢' : '🟡',
    fallback: ticket.legs.length < 3 ? 'HT-only' : null,
  }));

  await fs.writeFile(OUTPUT_FILE, JSON.stringify({ tickets, telegram }, null, 2), 'utf-8');
  console.log(`Generated ${tickets.length} tickets to ${OUTPUT_FILE}`);
}

if (require.main === module) {
  buildTickets().catch((error) => {
    console.error('Failed to generate tickets', error.message);
    process.exit(1);
  });
}

module.exports = { buildTickets };
