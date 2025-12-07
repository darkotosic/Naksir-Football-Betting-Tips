const fs = require('fs/promises');
const path = require('path');
const OpenAI = require('openai');

const MATCHES_PATH = path.join(__dirname, '..', 'data', 'matches.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'predictions.json');
const API_KEY = process.env.OPENAI_API_KEY;
const MAX_CONCURRENT = 3;

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: API_KEY });

function buildPromptForMarket(candidate, market) {
  return `


Ti si Naksir AI analitičar za fudbalske utakmice.

Utakmica:

Liga: ${candidate.league} (${candidate.country})

Timovi: ${candidate.homeTeam} vs ${candidate.awayTeam}

Vreme početka: ${candidate.kickOff}

Tržište:

Tip: ${market.type}

Kvota: ${market.odd}

Interni score modela: ${market.score} / 100

Zadatak:

Vrati konačnu preporuku (SAMO za ovo tržište) u JSON formatu:
{
"pick": "OVER_1_5" | "BTTS_YES" | "SKIP",
"confidence": broj 0-100,
"reasoning": "kratko objašnjenje na srpskom"
}

Nemoj pisati ništa van JSON objekta.
`;
}

function scoreOver15Candidate(match) {
  const o = match.odds?.over15;
  if (!o || !o.home) return null;
  const odd = parseFloat(o.home);
  if (!odd || odd < 1.1 || odd > 1.35) return null;
  const base = 80 - (odd - 1.1) * 100; // linearna aproksimacija
  return Math.max(0, Math.min(100, base));
}

function scoreBttsYesCandidate(match) {
  const o = match.odds?.btts?.yes;
  if (!o) return null;
  const odd = parseFloat(o);
  if (!odd || odd < 1.2 || odd > 1.6) return null;
  const base = 75 - (odd - 1.2) * 80;
  return Math.max(0, Math.min(100, base));
}

function buildCandidates(matches) {
  const candidates = [];
  for (const m of matches) {
    const markets = [];
    const scoreO15 = scoreOver15Candidate(m);
    if (scoreO15 !== null && scoreO15 >= 62) {
      markets.push({
        type: 'OVER_1_5',
        score: scoreO15,
        odd: m.odds?.over15?.home ?? null,
      });
    }
    const scoreBTTS = scoreBttsYesCandidate(m);
    if (scoreBTTS !== null && scoreBTTS >= 62) {
      markets.push({
        type: 'BTTS_YES',
        score: scoreBTTS,
        odd: m.odds?.btts?.yes ?? null,
      });
    }
    if (markets.length === 0) continue;
    candidates.push({
      fixtureId: m.fixtureId,
      leagueId: m.leagueId,
      league: m.league,
      country: m.country,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      kickOff: m.date,
      date: m.date,
      odds: m.odds,
      markets,
    });
  }
  return candidates;
}

async function loadMatches() {
  const raw = await fs.readFile(MATCHES_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('No matches found in matches.json');
  }
  return data;
}

async function processMarketJob(job) {
  const prompt = buildPromptForMarket(job.candidate, job.market);

  let responseText = '';
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: 'You are a concise football betting analyst. Return JSON only, no prose.',
        },
        { role: 'user', content: prompt },
      ],
    });
    responseText = completion.choices?.[0]?.message?.content?.trim() ?? '';
  } catch (error) {
    console.error('OpenAI request failed for fixture', job.candidate.fixtureId, error);
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch (e) {
    console.error('JSON parse error for fixture', job.candidate.fixtureId, e);
    return null;
  }

  if (!parsed.pick || typeof parsed.confidence !== 'number') return null;
  if (parsed.pick === 'SKIP') return null;
  if (parsed.confidence < 62) return null;

  return {
    fixtureId: job.candidate.fixtureId,
    leagueId: job.candidate.leagueId,
    league: job.candidate.league,
    country: job.candidate.country,
    homeTeam: job.candidate.homeTeam,
    awayTeam: job.candidate.awayTeam,
    market: job.market.type,
    odd: job.market.odd,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning ?? '',
    generatedAt: new Date().toISOString(),
  };
}

async function main() {
  try {
    const matches = await loadMatches();
    if (matches.length === 0) {
      await fs.writeFile(OUTPUT_PATH, '[]', 'utf-8');
      return;
    }

    const candidates = buildCandidates(matches);
    const marketJobs = [];
    for (const c of candidates) {
      for (const m of c.markets) {
        marketJobs.push({ candidate: c, market: m });
      }
    }

    marketJobs.sort((a, b) => b.market.score - a.market.score);

    if (marketJobs.length === 0) {
      await fs.writeFile(OUTPUT_PATH, '[]', 'utf-8');
      console.warn('No candidates to process after rule-based scoring.');
      return;
    }

    const predictions = [];
    for (let i = 0; i < marketJobs.length; i += MAX_CONCURRENT) {
      const batch = marketJobs.slice(i, i + MAX_CONCURRENT).map(processMarketJob);
      const results = await Promise.allSettled(batch);
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          predictions.push(result.value);
        } else if (result.status === 'rejected') {
          console.warn('Prediction batch item rejected:', result.reason?.message || result.reason);
        }
      });
    }

    const sortedPredictions = predictions.filter(Boolean).sort((a, b) => b.confidence - a.confidence);

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(sortedPredictions, null, 2), 'utf-8');
    console.log(`Saved ${sortedPredictions.length} predictions to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Failed to generate predictions:', error.message);
    process.exit(1);
  }
}

main();
