const predictionsContainer = document.getElementById('predictions');
const refreshButton = document.getElementById('refresh');

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

  const badge = document.createElement('div');
  badge.className = 'badge';
  badge.textContent = `Confidence ${prediction.confidence}%`;

  const oddsRow = document.createElement('div');
  oddsRow.className = 'predictions';
  oddsRow.innerHTML = `
    <div class="pill"><span class="label">Prediction</span><span>${prediction.outcome}</span></div>
    <div class="pill"><span class="label">BTTS</span><span>${prediction.btts ? 'Yes' : 'No'}</span></div>
    <div class="pill"><span class="label">Over 2.5</span><span>${prediction.over25 ? 'Yes' : 'No'}</span></div>
  `;

  const reason = document.createElement('p');
  reason.className = 'reason';
  reason.textContent = prediction.reason;

  card.appendChild(header);
  card.appendChild(badge);
  card.appendChild(oddsRow);
  card.appendChild(reason);

  return card;
}

async function loadPredictions() {
  predictionsContainer.innerHTML = '<p class="empty-state">Učitavanje prognoza...</p>';
  try {
    const response = await fetch('data/predictions.json');
    if (!response.ok) {
      throw new Error(`Greška pri čitanju fajla: ${response.status}`);
    }
    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      predictionsContainer.innerHTML = '<p class="empty-state">Nema dostupnih prognoza.</p>';
      return;
    }

    predictionsContainer.innerHTML = '';
    data.forEach((prediction) => predictionsContainer.appendChild(createPredictionCard(prediction)));
  } catch (error) {
    console.error(error);
    predictionsContainer.innerHTML = '<p class="empty-state">Greška pri učitavanju prognoza. Pokušaj ponovo.</p>';
  }
}

window.addEventListener('DOMContentLoaded', loadPredictions);
refreshButton?.addEventListener('click', loadPredictions);
