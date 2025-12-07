# 🧠 Agents Specification – Naksir Football Betting Tips

This document outlines the autonomous scripts ("agents") used to fetch football data and generate predictions via OpenAI.

---

## Agent 1: `fetch_data.js`

**Purpose:**  
Fetch today's major football fixtures and associated bookmaker odds from API-Football.

**Tasks:**  
- Retrieve fixtures from API-Football
- Get 1X2 odds for each match
- Filter for major leagues
- Save to `/data/matches.json`

**Usage:**
```bash
node agents/fetch_data.js
```

**Dependencies:**
- `node-fetch` or Axios
- Env variable: `API_FOOTBALL_KEY`

---

## Agent 2: `generate_tips.js`

**Purpose:**  
Use OpenAI GPT to generate predictions and reasoning per match.

**Tasks:**  
- Read `matches.json`
- Prompt OpenAI for predictions:
  - 1X2 outcome
  - BTTS
  - Over 2.5 goals
  - Confidence & reasoning
- Output to `predictions.json`

**Example Prompt:**

```plaintext
Match: Arsenal vs Tottenham
Odds: 1.65 - 3.80 - 4.50
Who will win? Will both teams score? Over 2.5 goals?
Reply as JSON: {...}
```

**Usage:**
```bash
node agents/generate_tips.js
```

**Dependencies:**
- `openai` package
- Env variable: `OPENAI_API_KEY`

---

## Agent Execution Flow

1. Run `fetch_data.js`
2. Then run `generate_tips.js`
3. Serve updated `predictions.json` in frontend

---

## Automation (Future)

- Automate with GitHub Actions or cronjob
- Auto-push to GitHub Pages on script success

---

## Notes

- API keys must be secured
- Batch OpenAI requests to control cost