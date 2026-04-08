"""
FinSight — Meta-Synthesis Agent.
Combines technical, fundamental, sentiment, risk, and ML prediction outputs
into a unified investment verdict with a detailed research report.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import httpx

from backend.models.schemas import (
    FundamentalData,
    MLPrediction,
    RiskMetrics,
    SentimentData,
    SynthesisResult,
    TechnicalSignals,
)

logger = logging.getLogger(__name__)

# ── Configuration ───────────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
SYNTHESIS_MODEL = os.getenv("SYNTHESIS_MODEL", "anthropic/claude-haiku-4-5")

AGENT_BASE_WEIGHTS: dict[str, float] = {
    "technical": 0.22,
    "fundamental": 0.30,
    "sentiment": 0.13,
    "risk": 0.20,
    "ml_prediction": 0.15,
}

_SIGNAL_MAP = {"BUY": 1, "HOLD": 0, "SELL": -1}


def _detect_conflicts(
    tech_signal: str,
    fund_signal: str,
    sent_signal: str,
    ml_signal: str,
) -> str | None:
    """Return a note if any two agents directly conflict (BUY vs SELL)."""
    agents = {
        "Technical": tech_signal,
        "Fundamental": fund_signal,
        "Sentiment": sent_signal,
        "ML": ml_signal,
    }
    conflicts: list[str] = []
    names = list(agents.keys())
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            sig_a, sig_b = agents[a], agents[b]
            if (sig_a == "BUY" and sig_b == "SELL") or (
                sig_a == "SELL" and sig_b == "BUY"
            ):
                conflicts.append(
                    f"{a} ({sig_a}) conflicts with {b} ({sig_b})"
                )
    return "; ".join(conflicts) if conflicts else None


def _estimate_price_target(verdict: str, confidence: float) -> float:
    """Estimate price target percentage change based on verdict and confidence."""
    if verdict == "BUY":
        return round(8.0 + 7.0 * confidence, 1)  # +8% to +15%
    elif verdict == "SELL":
        return round(-5.0 - 7.0 * confidence, 1)  # -5% to -12%
    else:
        return round(-2.0 + 5.0 * confidence, 1)  # -2% to +3%


async def _generate_report(
    symbol: str,
    verdict: str,
    confidence: float,
    technical: TechnicalSignals,
    fundamental: FundamentalData,
    sentiment: SentimentData,
    risk: RiskMetrics,
    ml_prediction: MLPrediction,
    conflict_notes: str | None,
) -> str:
    """Call OpenRouter to generate a detailed research report."""
    if not OPENROUTER_API_KEY:
        return _fallback_report(
            symbol,
            verdict,
            confidence,
            technical,
            fundamental,
            sentiment,
            risk,
            ml_prediction,
        )

    system_prompt = (
        "You are a SEBI-registered equity research analyst writing "
        "institutional-grade research reports for Indian retail investors. "
        "Write clearly, use data-driven arguments, and avoid speculation."
    )

    user_prompt = f"""Write a 400-word equity research report for {symbol} (NSE).

PRE-CALCULATED VERDICT: {verdict} (Confidence: {confidence:.0%})

TECHNICAL DATA:
- RSI (14): {technical.rsi:.1f}
- MACD: {technical.macd:.4f} (Signal: {technical.macd_signal:.4f})
- Bollinger Bands: Lower {technical.bb_lower:.2f} | Middle {technical.bb_middle:.2f} | Upper {technical.bb_upper:.2f}
- SMA-50: {technical.sma_50:.2f} | SMA-200: {technical.sma_200:.2f}
- Trend: {technical.trend}
- Technical Signal: {technical.signal} ({technical.confidence:.0%})

FUNDAMENTAL DATA:
- Sector: {fundamental.sector}
- PE Ratio: {fundamental.pe_ratio or 'N/A'} (Sector Avg: {fundamental.sector_pe_avg:.1f})
- P/B Ratio: {fundamental.pb_ratio or 'N/A'}
- Debt-to-Equity: {fundamental.debt_to_equity or 'N/A'}
- EPS: {fundamental.eps or 'N/A'}
- Revenue Growth: {f'{fundamental.revenue_growth:.1%}' if fundamental.revenue_growth else 'N/A'}
- ROE: {f'{fundamental.roe:.1%}' if fundamental.roe else 'N/A'}
- Fundamental Signal: {fundamental.signal} ({fundamental.confidence:.0%})

SENTIMENT DATA:
- Score: {sentiment.sentiment_score:.2f} ({sentiment.sentiment_label})
- Key Themes: {', '.join(sentiment.key_themes)}
- Sentiment Signal: {sentiment.signal} ({sentiment.confidence:.0%})

ML PREDICTION DATA:
- Horizon: {ml_prediction.prediction_horizon}
- Predicted Direction: {ml_prediction.predicted_direction}
- ML Signal: {ml_prediction.signal} ({ml_prediction.prediction_confidence:.0%})
- Model: {ml_prediction.model_name}
- Test F1 Score: {ml_prediction.model_metrics.f1_score:.0%}
- Top Features: {', '.join(f.feature_name for f in ml_prediction.feature_importances[:3]) if ml_prediction.feature_importances else 'N/A'}

RISK DATA:
- Beta vs Nifty 50: {risk.beta:.2f}
- VaR (95%): {risk.var_95:.2%}
- Annualized Volatility: {risk.volatility_annualized:.1%}
- Sharpe Ratio: {risk.sharpe_ratio:.2f}
- Max Drawdown: {risk.max_drawdown:.1%}
- Risk Level: {risk.risk_level}

{f'CONFLICTS: {conflict_notes}' if conflict_notes else 'No agent conflicts detected.'}

Structure the report with these sections:
1. **Executive Summary** — 2-3 sentences with the verdict
2. **Technical Picture** — Key indicator readings and trend
3. **Fundamental Health** — Valuation, profitability, debt
4. **Market Sentiment** — News themes and market mood
5. **ML Outlook** — Model direction signal, confidence, and key drivers
6. **Risk Assessment** — Volatility, beta, drawdown profile
7. **Investment Verdict** — Final recommendation with rationale

End with: "Disclaimer: This report is AI-generated for educational purposes only and does not constitute investment advice. Consult a SEBI-registered advisor before making investment decisions."
"""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": SYNTHESIS_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1500,
                },
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()

    except Exception as exc:
        logger.error("Report generation failed for %s: %s", symbol, exc)
        return _fallback_report(
            symbol,
            verdict,
            confidence,
            technical,
            fundamental,
            sentiment,
            risk,
            ml_prediction,
        )


def _fallback_report(
    symbol: str,
    verdict: str,
    confidence: float,
    technical: TechnicalSignals,
    fundamental: FundamentalData,
    sentiment: SentimentData,
    risk: RiskMetrics,
    ml_prediction: MLPrediction,
) -> str:
    """Generate a template-based report when LLM is unavailable."""
    return f"""# {symbol} — Equity Research Report

## Executive Summary
Based on multi-factor analysis, {symbol} receives a **{verdict}** recommendation with {confidence:.0%} confidence. This assessment integrates technical, fundamental, sentiment, and risk analysis.

## Technical Picture
The stock shows a {technical.trend} trend with RSI at {technical.rsi:.1f}. MACD is {'above' if technical.macd > technical.macd_signal else 'below'} the signal line. Price is trading {'above' if technical.sma_50 > technical.sma_200 else 'below'} the golden cross zone (SMA-50 vs SMA-200). Technical signal: {technical.signal}.

## Fundamental Health
Operating in the {fundamental.sector} sector, the company has a PE of {fundamental.pe_ratio or 'N/A'} vs sector average of {fundamental.sector_pe_avg:.1f}. Debt-to-equity stands at {fundamental.debt_to_equity or 'N/A'} with ROE of {f'{fundamental.roe:.1%}' if fundamental.roe else 'N/A'}. Fundamental signal: {fundamental.signal}.

## Market Sentiment
Current sentiment is {sentiment.sentiment_label} (score: {sentiment.sentiment_score:.2f}). Key themes: {', '.join(sentiment.key_themes)}. Sentiment signal: {sentiment.signal}.

## ML Outlook
The {ml_prediction.model_name} forecasts a {ml_prediction.predicted_direction} move over the next 5 trading days with {ml_prediction.prediction_confidence:.0%} confidence, mapping to an {ml_prediction.signal} signal. The model achieved {ml_prediction.model_metrics.f1_score:.0%} weighted F1 on held-out test data.

## Risk Assessment
{symbol} has a beta of {risk.beta:.2f} vs Nifty 50 with annualised volatility of {risk.volatility_annualized:.1%}. VaR-95 is {risk.var_95:.2%} daily, and max drawdown is {risk.max_drawdown:.1%}. Risk level: {risk.risk_level}.

## Investment Verdict
**{verdict}** with {confidence:.0%} confidence.

Disclaimer: This report is AI-generated for educational purposes only and does not constitute investment advice. Consult a SEBI-registered advisor before making investment decisions.
"""


async def run(
    symbol: str,
    technical: TechnicalSignals,
    fundamental: FundamentalData,
    sentiment: SentimentData,
    risk: RiskMetrics,
    ml_prediction: MLPrediction,
) -> SynthesisResult:
    """
    Synthesise all agent outputs into a final verdict and report.
    """
    # ── 1. Adjust weights based on risk ─────────────────────────────
    weights = AGENT_BASE_WEIGHTS.copy()
    if risk.risk_level == "HIGH":
        weights["technical"] -= 0.05
        weights["fundamental"] += 0.05

    # ── 2. Convert signals to numeric ───────────────────────────────
    tech_num = _SIGNAL_MAP.get(technical.signal, 0)
    fund_num = _SIGNAL_MAP.get(fundamental.signal, 0)
    sent_num = _SIGNAL_MAP.get(sentiment.signal, 0)
    ml_num = _SIGNAL_MAP.get(ml_prediction.signal, 0)

    # Risk doesn't produce BUY/SELL directly — use inverse of risk
    risk_num = {"LOW": 1, "MEDIUM": 0, "HIGH": -1}.get(risk.risk_level, 0)

    # ── 3. Weighted score ───────────────────────────────────────────
    weighted_score = (
        tech_num * technical.confidence * weights["technical"]
        + fund_num * fundamental.confidence * weights["fundamental"]
        + sent_num * sentiment.confidence * weights["sentiment"]
        + risk_num * 0.7 * weights["risk"]  # use moderate confidence for risk
        + ml_num * ml_prediction.prediction_confidence * weights["ml_prediction"]
    )

    # ── 4. Final verdict ────────────────────────────────────────────
    if weighted_score > 0.15:
        verdict = "BUY"
    elif weighted_score < -0.15:
        verdict = "SELL"
    else:
        verdict = "HOLD"

    overall_confidence = round(min(abs(weighted_score) / 0.5, 1.0), 2)

    # ── 5. Conflict detection ───────────────────────────────────────
    conflict_notes = _detect_conflicts(
        technical.signal,
        fundamental.signal,
        sentiment.signal,
        ml_prediction.signal,
    )

    # ── 6. Price target estimate ────────────────────────────────────
    price_target_pct = _estimate_price_target(verdict, overall_confidence)

    # ── 7. Generate detailed report ─────────────────────────────────
    detailed_report = await _generate_report(
        symbol, verdict, overall_confidence,
        technical, fundamental, sentiment, risk, ml_prediction,
        conflict_notes,
    )

    # ── Summary ─────────────────────────────────────────────────────
    summary = (
        f"{verdict} {symbol} with {overall_confidence:.0%} confidence. "
        f"Technical: {technical.signal}, Fundamental: {fundamental.signal}, "
        f"Sentiment: {sentiment.signal}, ML: {ml_prediction.signal}, Risk: {risk.risk_level}."
    )

    logger.info(
        "%s synthesis: verdict=%s confidence=%.2f weighted_score=%.4f",
        symbol, verdict, overall_confidence, weighted_score,
    )

    return SynthesisResult(
        symbol=symbol,
        final_verdict=verdict,
        overall_confidence=overall_confidence,
        price_target_pct=price_target_pct,
        summary=summary,
        detailed_report=detailed_report,
        agent_weights=weights,
        conflict_notes=conflict_notes,
        generated_at=datetime.now(timezone.utc),
    )
