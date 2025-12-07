const { createBuilderLeg } = require('./utils');

function builder_first_half_goals(match) {
  const over15 = match.odds?.over15?.home;
  const leg = createBuilderLeg(match, 'O15_HT', over15, {
    family: 'GOALS',
  });
  return leg ? [leg] : [];
}

module.exports = builder_first_half_goals;
