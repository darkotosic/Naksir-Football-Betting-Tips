# ⚽ Naksir Football Betting Tips

Naksir is an AI-powered football betting tips web application inspired by the BetMines app. It generates daily predictions for major football leagues using real-time match data and OpenAI's prediction capabilities. The app is fully static and deployable on GitHub Pages.

---

## 🔮 Features

- Daily match predictions for:
  - 1X2 (Home/Draw/Away)
  - Over/Under 2.5 Goals
  - Both Teams to Score (BTTS)
- AI-generated reasoning for each prediction
- Integrated bookmaker odds (via API-Football)
- Standalone static site (HTML/CSS/JS) hosted on GitHub Pages
- Modular script agents for fetching data and generating tips

---

## 📁 Project Structure

```
.
├── index.html                  # Main page
├── /assets
│   ├── style.css               # Page styling
│   └── app.js                  # Frontend rendering logic
├── /data
│   └── predictions.json        # Auto-generated prediction dataset
├── /agents
│   ├── fetch_data.js           # Gets fixtures & odds from API-Football
│   └── generate_tips.js        # Uses OpenAI to generate predictions
├── README.md
└── agents.md
```

---

## 🚀 Quick Start

### 1. Clone this repo

```bash
git clone https://github.com/darkotosic/Naksir-Football-Betting-Tips.git
cd Naksir-Football-Betting-Tips
```

### 2. Get API Keys

- Sign up at [https://api-football.com](https://api-football.com) to get your **API_FOOTBALL_KEY**
- Create an account at [https://platform.openai.com](https://platform.openai.com) to get your **OPENAI_API_KEY**

### 3. Configure Environment

Create a `.env` file:

```bash
API_FOOTBALL_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_key_here
```

Or export them manually:

```bash
export API_FOOTBALL_KEY=your_api_key_here
export OPENAI_API_KEY=your_openai_key_here
```

---

## 🛠️ Generate Daily Predictions

```bash
node agents/fetch_data.js      # Step 1: Fetch fixtures & odds
node agents/generate_tips.js   # Step 2: Generate predictions using OpenAI
```

This will update `/data/predictions.json`. Open `index.html` to see the predictions or push to GitHub for deployment.

---

## 🌐 GitHub Pages Deployment

1. Commit your changes
2. Go to your repo settings > Pages
3. Set source to `main` branch `/ (root)`
4. Visit: `https://darkotosic.github.io/Naksir-Football-Betting-Tips/`

---

## 🧠 Tech Stack

- [API-Football](https://www.api-football.com/documentation)
- [OpenAI API](https://platform.openai.com/docs)
- HTML, CSS, JavaScript
- GitHub Pages

---

## 📈 Future Enhancements

- Add daily best bet ("Doubling" or "Risk of the Day")
- Leaderboard with fake tipster profiles
- Real-time live scores
- Community voting for predictions

---

## 📜 License

MIT License © [darkotosic](https://github.com/darkotosic)