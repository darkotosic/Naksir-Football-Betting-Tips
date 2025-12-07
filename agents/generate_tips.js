const fs = require('fs/promises');
const path = require('path');
const OpenAI = require('openai');

const MATCHES_PATH = path.join(__dirname, '..', 'data', 'matches.json');
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'predictions.json');
const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY environment variable.');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: API_KEY });

async function loadMatches() {
  const raw = await fs.readFile(MATCHES_PATH, 'utf-8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('No matches found in matches.json');
  }
  return data;
}

function buildPrompt(match) {
  const homeOdd = match.odds?.home ?? 'N/A';
  const drawOdd = match.odds?.draw ?? 'N/A';
  const awayOdd = match.odds?.away ?? 'N/A';
  return [
    `Match: ${match.homeTeam} vs ${match.awayTeam}`,
    `Odds: ${homeOdd} - ${drawOdd} - ${awayOdd}`,
    'Will both teams score? Over 2.5 goals? Respond with JSON only:',
    '{"outcome": "HomeWin|Draw|AwayWin", "btts": true, "over25": true, "confidence": 84, "reason": "..."}',
  ].join('\n');
}

async function generatePrediction(match) {
  const prompt = buildPrompt(match);
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content: 'You are a concise football betting analyst. Return JSON only, no prose.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const content = completion.choices?.[0]?.message?.content?.trim();
  try {
    const parsed = JSON.parse(content);
    return {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: match.date,
      odds: match.odds,
      outcome: parsed.outcome,
      btts: parsed.btts,
      over25: parsed.over25,
      confidence: parsed.confidence,
      reason: parsed.reason,
    };
  } catch (error) {
    console.warn('Could not parse model response, falling back to defaults.', content);
    return {
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      date: match.date,
      odds: match.odds,
      outcome: 'HomeWin',
      btts: false,
      over25: false,
      confidence: 50,
      reason: 'Model response could not be parsed.',
    };
  }
}

async function main() {
  try {
    const matches = await loadMatches();
    if (matches.length === 0) {
      await fs.writeFile(OUTPUT_PATH, '[]', 'utf-8');
      return;
    }

    const predictions = [];
    for (const match of matches) {
      try {
        const prediction = await generatePrediction(match);
        predictions.push(prediction);
      } catch (error) {
        console.warn(`Skipping match ${match.homeTeam} vs ${match.awayTeam}:`, error.message);
      }
    }

    await fs.writeFile(OUTPUT_PATH, JSON.stringify(predictions, null, 2), 'utf-8');
    console.log(`Saved ${predictions.length} predictions to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Failed to generate predictions:', error.message);
    process.exit(1);
  }
}

main();
