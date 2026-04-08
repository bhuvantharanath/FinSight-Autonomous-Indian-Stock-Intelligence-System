"""
FinSight — Fundamental Analysis Agent.
Fetches company fundamentals via yfinance and scores them against
sector-specific benchmarks.
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Optional

import yfinance as yf

from backend.models.schemas import FundamentalData, OHLCVData

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=4)

SECTOR_PE_AVERAGES: dict[str, float] = {
    "Energy": 18.0,
    "Banking": 14.0,
    "Financial Services": 14.0,
    "IT": 28.0,
    "Technology": 28.0,
    "Pharma": 22.0,
    "Healthcare": 22.0,
    "FMCG": 45.0,
    "Consumer Defensive": 45.0,
    "Consumer Cyclical": 30.0,
    "Auto": 20.0,
    "Industrials": 20.0,
    "Metal": 12.0,
    "Basic Materials": 12.0,
    "Telecom": 30.0,
    "Communication Services": 30.0,
    "Realty": 25.0,
    "Real Estate": 25.0,
    "Utilities": 18.0,
    "Default": 20.0,
}


def _fetch_info(symbol: str) -> dict[str, Any]:
    """Synchronous helper — fetch Ticker().info dict."""
    clean = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
    for suffix in (".NS", ".BO"):
        try:
            ticker = yf.Ticker(f"{clean}{suffix}")
            info = ticker.info
            if info and info.get("regularMarketPrice") is not None:
                return info
        except Exception as exc:
            logger.warning("Ticker.info failed for %s%s: %s", clean, suffix, exc)
    return {}


async def run(symbol: str, ohlcv: OHLCVData) -> FundamentalData:
    """
    Fetch fundamental data via yfinance and produce a scored signal.
    """
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(_executor, _fetch_info, symbol)

    # ── Extract metrics (all may be None) ───────────────────────────
    pe: Optional[float] = info.get("trailingPE")
    pb: Optional[float] = info.get("priceToBook")
    de: Optional[float] = info.get("debtToEquity")
    eps: Optional[float] = info.get("trailingEps")
    rev_growth: Optional[float] = info.get("revenueGrowth")
    roe: Optional[float] = info.get("returnOnEquity")
    sector: str = info.get("sector", "Default")

    # Convert debtToEquity from percentage to ratio if > 10
    if de is not None and de > 10:
        de = de / 100.0

    sector_pe = SECTOR_PE_AVERAGES.get(sector, SECTOR_PE_AVERAGES["Default"])

    # ── Scoring ─────────────────────────────────────────────────────
    score = 0

    # PE vs sector average
    if pe is not None:
        if pe < sector_pe * 0.8:
            score += 2
        elif pe > sector_pe * 1.3:
            score -= 2
        # else 0

    # Debt-to-equity
    if de is not None:
        if de < 0.5:
            score += 2
        elif de <= 1.5:
            score += 1
        elif de <= 3.0:
            score -= 1
        else:
            score -= 2

    # Revenue growth
    if rev_growth is not None:
        if rev_growth > 0.15:
            score += 2
        elif rev_growth > 0:
            score += 1
        else:
            score -= 2

    # Return on equity
    if roe is not None:
        if roe > 0.15:
            score += 2
        elif roe > 0.08:
            score += 1
        elif roe < 0:
            score -= 2

    # ── Signal & confidence ─────────────────────────────────────────
    if score > 4:
        signal = "BUY"
    elif score < -2:
        signal = "SELL"
    else:
        signal = "HOLD"

    confidence = round(min(abs(score) / 8.0, 1.0), 2)

    # ── Reasoning ───────────────────────────────────────────────────
    pe_str = f"PE {pe:.1f} vs sector avg {sector_pe:.1f}" if pe else "PE unavailable"
    de_str = f"D/E {de:.2f}" if de else "D/E unavailable"
    roe_str = f"ROE {roe:.1%}" if roe else "ROE unavailable"
    rev_str = f"revenue growth {rev_growth:.1%}" if rev_growth else "revenue growth unavailable"

    reasoning = (
        f"{symbol} ({sector}) has {pe_str}, {de_str}, and {roe_str}. "
        f"With {rev_str}, the fundamental score is {score}/8, "
        f"indicating a {signal} signal with {confidence:.0%} confidence."
    )

    logger.info(
        "%s fundamental: signal=%s confidence=%.2f pe=%s de=%s roe=%s",
        symbol, signal, confidence, pe, de, roe,
    )

    return FundamentalData(
        symbol=symbol,
        pe_ratio=round(pe, 2) if pe is not None else None,
        pb_ratio=round(pb, 2) if pb is not None else None,
        debt_to_equity=round(de, 2) if de is not None else None,
        eps=round(eps, 2) if eps is not None else None,
        revenue_growth=round(rev_growth, 4) if rev_growth is not None else None,
        roe=round(roe, 4) if roe is not None else None,
        sector=sector,
        sector_pe_avg=sector_pe,
        signal=signal,
        confidence=confidence,
        reasoning=reasoning,
    )
