const { createBuilderLeg } = require('./utils');

function builder_btts_strict(match) {
  const bttsNo = match.odds?.btts?.no || match.odds?.btts?.yes;
  const leg = createBuilderLeg(match, 'BTTS_STRICT', bttsNo, {
    family: 'BTTS',
  });
  return leg ? [leg] : [];
}

module.exports = builder_btts_strict;
