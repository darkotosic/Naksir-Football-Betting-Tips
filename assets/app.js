const predictionsContainer = document.getElementById('predictions');
const refreshButton = document.getElementById('refresh');

function formatTimestamp(timestamp) {
  const parsedDate = timestamp ? new Date(timestamp) : null;

  if (!parsedDate || Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toLocaleString('sr-RS', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function createOddsSection(odds) {
  const oddsValues = odds && ['home', 'draw', 'away'].map((key) => odds[key]).filter(Boolean);
  if (!oddsValues || oddsValues.length === 0) return null;

  const oddsWrapper = document.createElement('div');
  oddsWrapper.className = 'odds';

  const oddsHeading = document.createElement('p');
  oddsHeading.className = 'section-title';
  oddsHeading.textContent = 'Kursevi (1X2)';

  const oddsTable = document.createElement('div');
  oddsTable.className = 'odds-table';

  const labelMap = {
    home: '1',
    draw: 'X',
    away: '2',
  };

  ['home', 'draw', 'away'].forEach((key) => {
    if (!odds[key]) return;
    const pill = document.createElement('div');
    pill.className = 'odds-pill';
    pill.innerHTML = `<span class="label">${labelMap[key]}</span><span class="value">${odds[key]}</span>`;
    oddsTable.appendChild(pill);
  });

  oddsWrapper.appendChild(oddsHeading);
  oddsWrapper.appendChild(oddsTable);

  return oddsWrapper;
}

function createPredictionCard(prediction) {
  const card = document.createElement('article');

  const confidenceValue = Number.parseFloat(prediction.confidence) || 0;
  const confidenceClass =
    confidenceValue >= 80 ? 'confidence-high' : confidenceValue >= 70 ? 'confidence-medium' : 'confidence-low';

  card.className = `card prediction-card ${confidenceClass}`;

  const leagueLabel = prediction.league && prediction.country
    ? `${prediction.league} (${prediction.country})`
    : prediction.league || prediction.country || 'Nepoznata liga';

  const header = document.createElement('div');
  header.className = 'card__header';

  const league = document.createElement('div');
  league.className = 'prediction-header';
  league.textContent = leagueLabel;
  header.appendChild(league);

  if (confidenceValue >= 80) {
    const premiumBadge = document.createElement('span');
    premiumBadge.className = 'prediction-badge-premium';
    premiumBadge.textContent = 'Premium tip';
    header.appendChild(premiumBadge);
  }

  const matchup = document.createElement('div');
  matchup.className = 'matchup';
  matchup.textContent = `${prediction.homeTeam} vs ${prediction.awayTeam}`;

  const kickoff = document.createElement('span');
  kickoff.className = 'kickoff';
  kickoff.textContent = prediction.date || 'TBD';

  const marketText = prediction.market || prediction.tip || prediction.outcome || 'Tip nedostaje';

  const market = document.createElement('div');
  market.className = 'prediction-market';
  market.textContent = `Tip: ${marketText}`;

  const metaRow = document.createElement('div');
  metaRow.className = 'card__meta';

  const oddValue = prediction.odd ?? prediction.odds?.value ?? prediction.odds?.odd ?? null;
  if (oddValue) {
    const oddPill = document.createElement('div');
    oddPill.className = 'pill';
    oddPill.innerHTML = `<span class="label">Kvota</span><span>${oddValue}</span>`;
    metaRow.appendChild(oddPill);
  }

  const confidencePill = document.createElement('div');
  confidencePill.className = 'pill';
  confidencePill.innerHTML = `<span class="label">Confidence</span><span>${confidenceValue}%</span>`;
  metaRow.appendChild(confidencePill);

  const formattedTimestamp = formatTimestamp(prediction.updatedAt || prediction.timestamp);
  if (formattedTimestamp) {
    const timestampBadge = document.createElement('div');
    timestampBadge.className = 'badge badge--muted';
    timestampBadge.textContent = `Last updated: ${formattedTimestamp}`;
    metaRow.appendChild(timestampBadge);
  }

  const confidenceBarWrapper = document.createElement('div');
  confidenceBarWrapper.className = `confidence-bar-wrapper ${confidenceClass}`;
  const confidenceBarFill = document.createElement('div');
  confidenceBarFill.className = 'confidence-bar-fill';
  const barWidth = Math.max(0, Math.min(confidenceValue, 100));
  confidenceBarFill.style.width = `${barWidth}%`;
  confidenceBarWrapper.appendChild(confidenceBarFill);

  const oddsSection = createOddsSection(prediction.odds);

  const reason = document.createElement('p');
  reason.className = 'prediction-reasoning';
  reason.textContent = prediction.reasoning || prediction.reason || 'Nema obrazloženja.';

  card.appendChild(header);
  card.appendChild(matchup);
  card.appendChild(kickoff);
  card.appendChild(market);
  card.appendChild(metaRow);
  card.appendChild(confidenceBarWrapper);
  if (oddsSection) card.appendChild(oddsSection);
  card.appendChild(reason);

  return card;
}

function renderState(message, showRetry = false) {
  const ctaMarkup = showRetry
    ? '<button id="retry-fetch" type="button" class="btn-secondary">Pokušaj ponovo</button>'
    : '';

  predictionsContainer.innerHTML = `<div class="empty-state"><p>${message}</p>${ctaMarkup}</div>`;

  if (showRetry) {
    document.getElementById('retry-fetch')?.addEventListener('click', () => refreshButton?.click());
  }
}

async function loadPredictions() {
  renderState('Učitavanje prognoza...', false);
  try {
    const response = await fetch('data/predictions.json');
    if (!response.ok) {
      throw new Error(`Greška pri čitanju fajla: ${response.status}`);
    }
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      renderState('Trenutno nema dostupnih prognoza. Klikni na „Osveži prognoze“ da pokušaš ponovo za nekoliko minuta.', true);
      return;
    }

    predictionsContainer.innerHTML = '';
    data.forEach((prediction) => predictionsContainer.appendChild(createPredictionCard(prediction)));
  } catch (error) {
    console.error(error);
    renderState('Došlo je do greške pri učitavanju. Proveri konekciju i klikni na „Osveži prognoze“ da pokušaš ponovo.', true);
  }
}

window.addEventListener('DOMContentLoaded', loadPredictions);
refreshButton?.addEventListener('click', loadPredictions);
