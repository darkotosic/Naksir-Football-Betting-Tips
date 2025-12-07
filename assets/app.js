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
  card.className = 'card';

  const header = document.createElement('div');
  header.className = 'card__header';

  const matchup = document.createElement('div');
  matchup.className = 'matchup';
  matchup.textContent = `${prediction.homeTeam} vs ${prediction.awayTeam}`;

  const kickoff = document.createElement('span');
  kickoff.className = 'kickoff';
  kickoff.textContent = prediction.date || 'TBD';

  header.appendChild(matchup);
  header.appendChild(kickoff);

  const metaRow = document.createElement('div');
  metaRow.className = 'card__meta';

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = `Confidence ${prediction.confidence}%`;
  metaRow.appendChild(badge);

  const formattedTimestamp = formatTimestamp(prediction.updatedAt || prediction.timestamp);
  if (formattedTimestamp) {
    const timestampBadge = document.createElement('div');
    timestampBadge.className = 'badge badge--muted';
    timestampBadge.textContent = `Last updated: ${formattedTimestamp}`;
    metaRow.appendChild(timestampBadge);
  }

  const oddsRow = document.createElement('div');
  oddsRow.className = 'predictions';
  oddsRow.innerHTML = `
    <div class="pill"><span class="label">Prediction</span><span>${prediction.outcome}</span></div>
    <div class="pill"><span class="label">BTTS</span><span>${prediction.btts ? 'Yes' : 'No'}</span></div>
    <div class="pill"><span class="label">Over 2.5</span><span>${prediction.over25 ? 'Yes' : 'No'}</span></div>
  `;

  const oddsSection = createOddsSection(prediction.odds);

  const reason = document.createElement('p');
  reason.className = 'reason';
  reason.textContent = prediction.reason;

  card.appendChild(header);
  card.appendChild(metaRow);
  card.appendChild(oddsRow);
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
