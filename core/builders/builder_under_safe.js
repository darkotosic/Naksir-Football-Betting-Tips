const { createBuilderLeg } = require('./utils');

function builder_under_safe(match) {
  const over25 = match.odds?.over25?.home;
  if (!over25) return [];
  const impliedUnder = Math.max(1.01, 1.8 - over25);
  const leg = createBuilderLeg(match, 'U25_SAFE', impliedUnder, {
    family: 'GOALS',
  });
  return leg ? [leg] : [];
}

module.exports = builder_under_safe;
