<div align="center">

# 🔮 FinSight — Autonomous Indian Stock Intelligence System

**A multi-agent AI system that performs institutional-grade equity research on Indian stocks in real time.**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [API Reference](#-api-reference) · [Tech Stack](#-tech-stack)

</div>

---

## 📖 Overview

FinSight is an **autonomous multi-agent stock intelligence system** purpose-built for the **Indian equity market** (NSE/BSE). It orchestrates **10 specialized AI agents** that run concurrently — fetching live market data, computing technical indicators, analyzing fundamentals, gauging news sentiment via LLMs, assessing risk, predicting price direction with ML, performing deep exploratory data analysis, interpreting macro FII/DII flows, and stress-testing bullish calls through a built-in Critic — then synthesises everything into a single **BUY / HOLD / SELL** verdict with a detailed research report.

The system features a **"War Room"**-themed React dashboard with real-time progress tracking via Server-Sent Events (SSE), interactive candlestick charts (TradingView Lightweight Charts), per-stock drill-down reports, and a three-panel intelligence layout.

> ⚠️ **Disclaimer**: FinSight is built for **educational and research purposes only**. It is not SEBI-registered investment advice. Always consult a qualified financial advisor before making investment decisions.

---

## ✨ Features

| Category | Highlights |
|---|---|
| **Multi-Agent Pipeline** | 10 autonomous agents run in parallel across a 4-stage orchestrated pipeline |
| **Real-Time Streaming** | SSE-based live progress updates — watch each agent complete in real time |
| **Regime-Aware ML** | GradientBoosting ensemble with regime detection (bull/bear/sideways) for 5-day direction forecasting |
| **LLM-Powered Analysis** | Sentiment analysis, research report generation, and critic challenges via OpenRouter (Claude Haiku) |
| **War Room Dashboard** | Three-panel Next.js 16 UI — Intelligence Feed, Interactive Chart Room, Verdict Panel |
| **Macro Flow Intelligence** | NSE FII/DII activity tracking with confidence multiplier adjustment |
| **Critic Agent** | Automated devil's advocate that stress-tests bullish synthesis calls |
| **Exploratory Data Analysis** | Statistical distributions, outlier detection, volatility regimes, correlation matrices |
| **Multi-Stock Support** | Analyze up to 5 NSE/BSE stocks simultaneously with cross-correlation analysis |
| **Persistent Storage** | SQLite-backed run history with full agent output replay |
| **Conflict Detection** | Automatic identification of disagreements between agents and macro-flow divergences |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 16 — War Room)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │ Intelligence  │  │  Chart Room   │  │   Verdict    │             │
│  │   Feed (SSE)  │  │(Candlestick) │  │    Panel     │             │
│  │   28% width   │  │  44% width   │  │  28% width   │             │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘             │
│         └─────────────────┴─────────────────┘                      │
│                            │ Axios / SSE                            │
└────────────────────────────┼────────────────────────────────────────┘
                             │
                   ┌─────────▼─────────┐
                   │   FastAPI Server   │
                   │   (REST + SSE)     │
                   └─────────┬─────────┘
                             │
                   ┌─────────▼─────────┐
                   │   Orchestrator     │
                   │  (Pipeline Mgr)    │
                   └─────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
  ┌─────▼─────┐    ┌────────▼────────┐    ┌──────▼──────┐
  │  Stage 1   │    │    Stage 2      │    │   Stage 3   │
  │  Data      │    │ EDA+ML+Macro   │    │  Analysis   │
  │ Ingestion  │    │  (parallel)     │    │  (parallel) │
  └─────┬─────┘    └────────┬────────┘    └──────┬──────┘
        │                   │                    │
        ▼                   ▼                    ▼
 ┌────────────┐    ┌──────┬─────┬─────┐  ┌────┬────┬────┬────┐
 │  yFinance  │    │ EDA  │ ML  │Macro│  │Tech│Fund│Sent│Risk│
 │  (OHLCV)   │    │Agent │Agent│Agent│  │    │    │    │    │
 └────────────┘    └──────┴─────┴─────┘  └────┴────┴──┬─┴────┘
                                                       │
                                                ┌──────▼──────┐
                                                │  Synthesis   │
                                                │  Agent (LLM) │
                                                └──────┬──────┘
                                                       │
                                                ┌──────▼──────┐
                                                │Critic Agent │
                                                │(Devil's     │
                                                │ Advocate)   │
                                                └──────┬──────┘
                                                       │
                                                ┌──────▼──────┐
                                                │   SQLite DB  │
                                                └─────────────┘
```

### Pipeline Stages

| Stage | Agents | Execution | Description |
|-------|--------|-----------|-------------|
| **1** | Data Ingestion | Sequential per symbol | Fetches 1-year daily OHLCV from Yahoo Finance (NSE → BSE fallback) |
| **2** | EDA + ML Prediction + Macro | Parallel | Multi-stock EDA + regime-aware ML classifier + NSE FII/DII flows |
| **3** | Technical + Fundamental + Sentiment + Risk | Parallel per symbol | Core analysis agents run concurrently |
| **4** | Synthesis → Critic | Sequential per symbol | Weighted signal aggregation + LLM report → critic challenge loop |

---

## 🤖 Agent Details

### 1. Data Ingestion Agent
- **Source**: Yahoo Finance via `yfinance`
- **Data**: 1-year daily OHLCV (Open, High, Low, Close, Volume)
- **Fallback**: Tries `.NS` (NSE) first, then `.BO` (BSE)
- **Output**: `OHLCVData` with current price and daily change %

### 2. Technical Analysis Agent
- **Indicators**: RSI-14, MACD (12/26/9), Bollinger Bands (20, 2σ), SMA-50, SMA-200
- **Method**: Weighted scoring system across all indicators (max score ±8)
- **Output**: Trend classification (bullish/bearish/sideways) + BUY/SELL/HOLD signal with confidence

### 3. Fundamental Analysis Agent
- **Metrics**: PE ratio, PB ratio, Debt-to-Equity, EPS, Revenue Growth, ROE
- **Benchmark**: Compares against sector PE averages
- **Output**: Valuation assessment + BUY/SELL/HOLD signal

### 4. Sentiment Analysis Agent
- **Source**: Google News RSS (top 10 headlines per stock)
- **Engine**: LLM-powered analysis via OpenRouter (Claude Haiku)
- **Output**: Sentiment score (-1 to +1), key themes, trading signal
- **Fallback**: Returns neutral defaults if LLM is unavailable

### 5. Risk Assessment Agent
- **Metrics**: Beta (vs Nifty 50), Value-at-Risk (95%), Sharpe Ratio, Max Drawdown, Annualized Volatility
- **Classification**: LOW / MEDIUM / HIGH risk levels
- **Output**: Comprehensive risk profile with reasoning

### 6. ML Prediction Agent
- **Model**: Regime-Aware GradientBoosting Ensemble (scikit-learn)
- **Regime Detection**: Classifies market as bull/bear/sideways using volatility + SMA slope thresholds; trains separate models per regime
- **Features**: 27 engineered features across 5 categories:
  - **Momentum** (8): Returns (1d/3d/5d/10d/20d), RSI-14, Momentum-10, ROC-5
  - **Volatility** (6): Rolling vol (5d/10d/20d), ATR-14, BB Width, High-Low Range
  - **Volume** (4): Volume ratios (5d/20d), OBV change, Volume momentum
  - **Calendar** (4): Day of week, Month, Quarter, Month-end flag
  - **Technical** (5): SMA ratios (50/200), Price vs BB upper, MACD histogram, ADX-14
- **Validation**: Time-series cross-validation (5 splits) — no data leakage
- **Labels**: 3-class direction (DOWN < -2%, SIDEWAYS ±2%, UP > +2%) over 5-day horizon
- **Output**: Predicted direction, confidence, top-10 feature importances, full model metrics

### 7. EDA Agent (Exploratory Data Analysis)
- **Statistics**: Returns & volume distribution (mean, median, std, skewness, kurtosis, normality test)
- **Outlier Detection**: Z-score based identification of volume spikes, price gaps, volatility spikes
- **Volatility Regimes**: Low / Medium / High / Extreme classification with percentile ranking
- **Cross-Correlation**: Pairwise return correlations with relationship labeling
- **Chart Data**: Returns histogram, 30-day rolling volatility, volume MA ratio, price vs SMA overlays

### 8. Macro Flow Agent
- **Source**: NSE FII/DII Trade Activity API (`fiidiiTradeReact`)
- **Method**: Aggregates 5-day net FII and DII flows, classifies as BULLISH / NEUTRAL / BEARISH
- **Confidence Multiplier**: Adjusts synthesis confidence (1.1× for bullish FII, 0.9× for bearish)
- **Fallback**: Returns neutral defaults with 1.0× multiplier if NSE API is unreachable

### 9. Meta-Synthesis Agent
- **Method**: Weighted signal aggregation with dynamic weight adjustment
- **Base Weights**: Technical (22%), Fundamental (30%), Sentiment (13%), Risk (20%), ML (15%)
- **Dynamic Adjustment**: Risk level shifts weight from Technical to Fundamental
- **Macro Integration**: Applies FII/DII confidence multiplier to final confidence score
- **Conflict Detection**: Identifies BUY vs SELL disagreements across agents + macro divergences
- **Report**: LLM-generated 400-word institutional-grade equity research report
- **Output**: Final BUY/SELL/HOLD verdict, confidence, price target estimate, decision logic map

### 10. Critic Agent (Devil's Advocate)
- **Trigger**: Activates only when synthesis is strongly bullish (BUY with weighted score > 0.2)
- **Method**: LLM-powered challenge — identifies top 3 reasons the bullish thesis could be wrong
- **Penalty Calculation**: Applies 0–15% confidence penalty based on challenge severity
- **Bonus Penalty**: Extra 5% for challenges involving debt, leverage, or overvaluation
- **Output**: Challenge list + confidence penalty applied to synthesis result

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.11+** | Core language |
| **FastAPI** | Async REST API + SSE streaming |
| **SQLAlchemy 2.0** | ORM with SQLite persistence |
| **Pydantic v2** | Schema validation with 20+ models |
| **yfinance** | Yahoo Finance market data |
| **pandas + pandas-ta** | Data manipulation + technical indicators |
| **scikit-learn** | ML pipeline (StandardScaler + GradientBoosting regime ensemble) |
| **scipy** | Statistical tests (Shapiro-Wilk normality) |
| **feedparser** | Google News RSS parsing |
| **httpx** | Async HTTP client for OpenRouter LLM + NSE API calls |
| **sse-starlette** | Server-Sent Events for real-time streaming |
| **python-dotenv** | Environment variable management |

### Frontend
| Technology | Purpose |
|---|---|
| **Next.js 16** | React framework with App Router |
| **React 19** | UI components |
| **TypeScript** | Type-safe frontend |
| **Tailwind CSS 4** | Utility-first styling (War Room theme) |
| **Lightweight Charts v5** | TradingView-powered candlestick chart with markers |
| **Recharts** | Interactive charts (bar, radar, heatmap, histogram) |
| **Lucide React** | Icon library |
| **Axios** | HTTP client for API communication |

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.11+** and **pip**
- **Node.js 18+** and **npm**
- (Optional) **OpenRouter API key** for LLM-powered sentiment analysis & report generation

### 1. Clone the Repository

```bash
git clone https://github.com/bhuvantharanath/FinSight-Autonomous-Indian-Stock-Intelligence-System.git
cd FinSight-Autonomous-Indian-Stock-Intelligence-System
```

### 2. Backend Setup

```bash
# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r backend/requirements.txt
```

### 3. Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env
```

Edit `.env` with your settings:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
SYNTHESIS_MODEL=anthropic/claude-haiku-4-5
SENTIMENT_MODEL=anthropic/claude-haiku-4-5
```

> **Note**: The system works without an API key — sentiment defaults to neutral, reports use template-based generation, and the critic agent skips LLM challenges.

### 4. Start the Backend

```bash
uvicorn backend.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Visit `http://localhost:8000/docs` for the interactive Swagger UI.

### 5. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local

# Start development server
npm run dev
```

The dashboard will be available at `http://localhost:3000`.

---

## 📡 API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/analyze` | Start a new multi-stock analysis run |
| `GET` | `/status/{run_id}` | Get full run status with all agent outputs |
| `GET` | `/stream/{run_id}` | SSE stream for real-time progress updates |
| `GET` | `/runs` | List the 10 most recent analysis runs |
| `GET` | `/report/{run_id}/{symbol}` | Get detailed synthesis report for a symbol |
| `GET` | `/eda/{run_id}` | Get exploratory data analysis results |
| `GET` | `/ml/{run_id}/{symbol}` | Get ML prediction details for a symbol |
| `GET` | `/health` | Liveness probe |

### Example: Start Analysis

```bash
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbols": ["RELIANCE", "TCS", "INFY"]}'
```

**Response** (202 Accepted):
```json
{
  "run_id": "a1b2c3d4-...",
  "status": "started",
  "message": "Analysis started for RELIANCE, TCS, INFY. Track progress at /status/a1b2c3d4-..."
}
```

### Example: Poll Status

```bash
curl http://localhost:8000/status/{run_id}
```

**Response**:
```json
{
  "run_id": "a1b2c3d4-...",
  "symbols": ["RELIANCE", "TCS", "INFY"],
  "status": "completed",
  "agents": {
    "technical_RELIANCE": {
      "agent_name": "technical",
      "status": "completed",
      "signal": "BUY",
      "confidence": 0.75,
      "reasoning": "RELIANCE shows a bullish trend with RSI at 42.3..."
    }
  },
  "results": {
    "RELIANCE": {
      "final_verdict": "BUY",
      "overall_confidence": 0.68,
      "price_target_pct": 12.8,
      "summary": "BUY RELIANCE with 68% confidence..."
    }
  }
}
```

---

## 📁 Project Structure

```
FinSight-Autonomous-Indian-Stock-Intelligence-System/
├── backend/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── data_ingestion.py     # Yahoo Finance OHLCV fetcher
│   │   ├── technical.py          # RSI, MACD, Bollinger, SMA analysis
│   │   ├── fundamental.py        # PE, PB, D/E, ROE valuation
│   │   ├── sentiment.py          # News RSS + LLM sentiment
│   │   ├── risk.py               # Beta, VaR, Sharpe, drawdown
│   │   ├── ml_agent.py           # Regime-aware GradientBoosting ensemble
│   │   ├── eda_agent.py          # Exploratory data analysis
│   │   ├── macro_agent.py        # NSE FII/DII flow analysis
│   │   ├── synthesis.py          # Meta-synthesis + report generation
│   │   └── critic.py             # Devil's advocate challenge agent
│   ├── models/
│   │   └── schemas.py            # 20+ Pydantic v2 models
│   ├── database.py               # SQLAlchemy ORM + CRUD operations
│   ├── orchestrator.py           # 4-stage async pipeline coordinator
│   ├── main.py                   # FastAPI app with REST + SSE endpoints
│   └── requirements.txt          # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx          # Intelligence Terminal (stock input)
│   │   │   ├── layout.tsx        # Root layout with metadata + fonts
│   │   │   ├── globals.css       # War Room theme + CSS variables
│   │   │   ├── run/[runId]/
│   │   │   │   └── page.tsx      # War Room 3-panel analysis view
│   │   │   └── history/
│   │   │       └── page.tsx      # Mission Archive (past runs)
│   │   ├── components/
│   │   │   ├── Navbar.tsx             # Navigation bar
│   │   │   ├── IntelligenceFeed.tsx   # Real-time agent status feed (SSE)
│   │   │   ├── VerdictPanel.tsx       # Final verdict + confidence display
│   │   │   ├── EvidenceTrail.tsx      # Agent decision logic trail
│   │   │   ├── warroom/
│   │   │   │   └── ChartRoom.tsx      # Chart panel wrapper
│   │   │   └── charts/
│   │   │       ├── CandlestickChart.tsx      # TradingView lightweight-charts
│   │   │       ├── ConfusionMatrix.tsx       # ML model confusion matrix
│   │   │       ├── CorrelationHeatmap.tsx    # Cross-stock correlation
│   │   │       ├── FeatureImportanceChart.tsx# ML feature importance
│   │   │       ├── MLPredictionCard.tsx      # ML prediction summary
│   │   │       ├── ReturnsHistogram.tsx      # Return distribution
│   │   │       └── VolatilityChart.tsx       # Rolling volatility
│   │   └── lib/
│   │       ├── api.ts             # Typed API client (Axios)
│   │       └── utils.ts           # Signal colors, formatting utilities
│   ├── next.config.ts
│   ├── package.json
│   └── tsconfig.json
├── .env.example                   # Environment variable template
├── .gitignore
└── README.md
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | No | `""` | OpenRouter API key for LLM features |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenRouter API base URL |
| `SYNTHESIS_MODEL` | No | `anthropic/claude-haiku-4-5` | LLM model for report generation |
| `SENTIMENT_MODEL` | No | `anthropic/claude-haiku-4-5` | LLM model for sentiment analysis |

### Synthesis Agent Weights

The final verdict is computed using weighted signals from all agents. Default weights (configurable in `backend/agents/synthesis.py`):

```
Fundamental: 30%  ████████████████
Technical:   22%  ████████████
Risk:        20%  ███████████
ML:          15%  ████████
Sentiment:   13%  ███████
```

After synthesis, the Macro Flow agent applies a confidence multiplier (0.9×–1.1×), and the Critic agent may apply an additional penalty (0–15%).

---

## 🧪 Usage Examples

### Single Stock Analysis
```
Input: RELIANCE
```
Analyzes Reliance Industries across all 10 agents and produces a comprehensive verdict.

### Multi-Stock Comparison
```
Input: RELIANCE, TCS, INFY, HDFCBANK, ICICIBANK
```
Runs full analysis on all 5 stocks, plus generates cross-correlation analysis and portfolio-level EDA.

### Supported Symbols
Any valid **NSE** or **BSE** ticker symbol. Examples:
- Large Cap: `RELIANCE`, `TCS`, `INFY`, `HDFCBANK`, `ICICIBANK`
- Mid Cap: `BAJFINANCE`, `ADANIGREEN`, `TATAMOTORS`, `WIPRO`
- Banking: `SBIN`, `KOTAKBANK`, `AXISBANK`, `INDUSINDBK`

---

## 📊 War Room Dashboard

### Intelligence Feed (Left Panel)
- Real-time SSE-powered agent status feed with animated transitions
- Per-agent signal badges (BUY/SELL/HOLD) and confidence scores
- Live progress tracking with color-coded states (pending → running → completed/failed)

### Chart Room (Center Panel)
- **Candlestick Chart** — TradingView Lightweight Charts v5 with OHLCV data
- **Agent Signal Markers** — Visual arrows on chart for each agent's signal
- **Time Range Selector** — 1M / 3M / 6M / 1Y view toggles
- **Volume Overlay** — Color-coded volume bars (green for up, red for down)

### Verdict Panel (Right Panel)
- Final BUY/SELL/HOLD verdict with confidence percentage
- Price target estimate with directional indicator
- Agent weight breakdown visualization
- Conflict detection and macro flow warnings

### Evidence Trail (Center Bottom)
- Interactive agent decision cards showing signal, weight, and key triggers
- Critic challenge display for bullish calls
- Hover-to-highlight: hovering a card highlights corresponding chart marker

### History Page (Mission Archive)
- Tabular view of all past analysis runs
- Status badges, duration tracking, and direct links to War Room views

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Yahoo Finance](https://finance.yahoo.com/) via **yfinance** for market data
- [OpenRouter](https://openrouter.ai/) for LLM API access
- [Google News RSS](https://news.google.com/) for financial news headlines
- [pandas-ta](https://github.com/twopirllc/pandas-ta) for technical indicators
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/) for candlestick rendering
- [Recharts](https://recharts.org/) for React charting components
- [NSE India](https://www.nseindia.com/) for FII/DII activity data

---

<div align="center">

**Built with ❤️ for the Indian investor community**

*FinSight is for educational purposes only. Not SEBI-registered investment advice.*

</div>