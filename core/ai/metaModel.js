function scoreLeg(leg, signals = {}) {
  const base = Math.min(Math.max((1.6 - leg.odd) * 100, 30), 85);
  const form = signals.form || 0;
  const xg = signals.xG || 0;
  const shots = signals.shots || 0;
  const momentum = signals.momentum || 0;
  const h2h = signals.h2h || 0;
  const leagueWeight = leg.meta?.leagueWeight || 1;

  const confidence = Math.round(
    Math.min(
      100,
      base + form * 0.1 + xg * 0.05 + shots * 0.03 + momentum * 0.05 + h2h * 0.02 + leagueWeight * 5
    )
  );

  const riskFlags = [];
  if (leg.odd > 1.4) riskFlags.push('HIGH_ODD');
  if (confidence < 62) riskFlags.push('LOW_CONFIDENCE');

  const reason = `Auto-eval: form=${form}, xG=${xg}, shots=${shots}, momentum=${momentum}, h2h=${h2h}, base=${base.toFixed(
    2
  )}`;

  return {
    ...leg,
    confidence,
    risk_flags: riskFlags,
    reason,
  };
}

function scoreLegs(legs, signalProvider = () => ({})) {
  return legs
    .map((leg) => scoreLeg(leg, signalProvider(leg)))
    .filter((leg) => leg.confidence >= 62 && !leg.risk_flags.includes('LOW_CONFIDENCE'));
}

module.exports = { scoreLegs, scoreLeg };
