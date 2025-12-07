const builder_draw_safety = require('./builder_draw_safety');
const builder_first_half_goals = require('./builder_first_half_goals');
const builder_under_safe = require('./builder_under_safe');
const builder_btts_strict = require('./builder_btts_strict');

const BUILDERS = [
  builder_draw_safety,
  builder_first_half_goals,
  builder_under_safe,
  builder_btts_strict,
];

function runBuilders(fixtures) {
  const legs = [];
  fixtures.forEach((fixture) => {
    BUILDERS.forEach((builder) => {
      const result = builder(fixture) || [];
      result.forEach((leg) => {
        if (leg) {
          legs.push({ ...leg, builder: builder.name });
        }
      });
    });
  });
  return legs;
}

module.exports = { BUILDERS, runBuilders };
