const { createBuilderLeg } = require('./utils');

function builder_draw_safety(match) {
  const drawOdd = match.odds?.matchWinner?.draw;
  const leg = createBuilderLeg(match, 'DRAW_SFTY', drawOdd, {
    family: '1X2',
  });
  return leg ? [leg] : [];
}

module.exports = builder_draw_safety;
