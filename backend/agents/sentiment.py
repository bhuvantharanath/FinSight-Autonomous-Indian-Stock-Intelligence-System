"""
FinSight — Sentiment Analysis Agent.
Fetches news headlines from Google News RSS, then uses an LLM via
OpenRouter to assess market sentiment and produce a trading signal.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor
from typing import Any

import feedparser
import httpx

from backend.models.schemas import SentimentData

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=2)

# ── Configuration ───────────────────────────────────────────────────
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
SENTIMENT_MODEL = os.getenv("SENTIMENT_MODEL", "anthropic/claude-haiku-4-5")

_SYSTEM_PROMPT = (
    "You are a financial sentiment analyzer. Analyze these news headlines "
    "about an Indian stock. Return ONLY valid JSON with these exact keys: "
    "sentiment_score (float -1.0 to 1.0), "
    "sentiment_label (exactly one of: positive, negative, neutral), "
    "key_themes (array of 3 strings, each max 5 words), "
    "signal (exactly one of: BUY, SELL, HOLD), "
    "confidence (float 0.0 to 1.0), "
    "reasoning (string, max 2 sentences). "
    "Do not include any text outside the JSON object."
)


def _fetch_headlines(symbol: str) -> list[str]:
    """Synchronous helper — fetch headlines from Google News RSS."""
    clean = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
    url = (
        f"https://news.google.com/rss/search?"
        f"q={clean}+NSE+stock&hl=en-IN&gl=IN&ceid=IN:en"
    )
    try:
        feed = feedparser.parse(url)
        if feed.entries:
            return [entry.title for entry in feed.entries[:10]]
    except Exception as exc:
        logger.warning("feedparser failed for %s: %s", clean, exc)

    # Fallback headlines
    logger.info("Using fallback headlines for %s", clean)
    return [
        f"{clean} stock analysis",
        f"{clean} NSE performance",
        f"{clean} quarterly results India",
    ]


def _neutral_defaults(symbol: str, headlines: list[str]) -> SentimentData:
    """Return a neutral SentimentData when LLM parsing fails."""
    return SentimentData(
        symbol=symbol,
        headlines=headlines,
        sentiment_score=0.0,
        sentiment_label="neutral",
        key_themes=["market analysis", "stock performance", "sector trends"],
        signal="HOLD",
        confidence=0.3,
        reasoning=(
            f"Sentiment analysis for {symbol} returned neutral due to "
            "insufficient or ambiguous signals from available headlines."
        ),
    )


async def _call_openrouter(headlines: list[str]) -> str:
    """Call OpenRouter chat completion and return the raw model content."""
    payload = {
        "model": SENTIMENT_MODEL,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Headlines: {json.dumps(headlines)}",
            },
        ],
        "temperature": 0.2,
        "max_tokens": 512,
    }
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(2):
            try:
                response = await client.post(
                    f"{OPENROUTER_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()

                # Strip markdown fences if present
                if content.startswith("```"):
                    lines = content.split("\n")
                    content = "\n".join(
                        line for line in lines if not line.strip().startswith("```")
                    )

                return content
            except httpx.RequestError as exc:
                if attempt == 0:
                    logger.warning(
                        "OpenRouter network error, retrying once in 2s: %s", exc
                    )
                    await asyncio.sleep(2)
                    continue
                raise

    # Defensive fallback; loop always returns or raises.
    raise RuntimeError("OpenRouter request unexpectedly produced no response")


async def run(symbol: str) -> SentimentData:
    """
    Fetch news headlines and analyse sentiment via LLM.
    Returns neutral defaults on any failure.
    """
    loop = asyncio.get_event_loop()
    headlines = await loop.run_in_executor(_executor, _fetch_headlines, symbol)

    logger.info("%s sentiment: fetched %d headlines", symbol, len(headlines))

    # If no API key, return neutral defaults
    if not OPENROUTER_API_KEY:
        logger.warning("OPENROUTER_API_KEY not set — returning neutral defaults")
        return _neutral_defaults(symbol, headlines)

    try:
        raw_content = await _call_openrouter(headlines)

        try:
            result: dict[str, Any] = json.loads(raw_content)
        except (json.JSONDecodeError, TypeError) as exc:
            logger.error("Sentiment JSON parsing failed for %s: %s", symbol, exc)
            return _neutral_defaults(symbol, headlines)

        # Validate and clamp values
        sentiment_score = max(-1.0, min(1.0, float(result.get("sentiment_score", 0.0))))
        sentiment_label = result.get("sentiment_label", "neutral")
        if sentiment_label not in ("positive", "negative", "neutral"):
            sentiment_label = "neutral"

        signal = result.get("signal", "HOLD")
        if signal not in ("BUY", "SELL", "HOLD"):
            signal = "HOLD"

        confidence = max(0.0, min(1.0, float(result.get("confidence", 0.5))))

        key_themes = result.get("key_themes", [])
        if not isinstance(key_themes, list) or len(key_themes) < 1:
            key_themes = ["market analysis", "stock performance", "sector trends"]

        reasoning = str(result.get("reasoning", f"Sentiment analysis for {symbol}."))

        logger.info(
            "%s sentiment: label=%s score=%.2f signal=%s confidence=%.2f",
            symbol, sentiment_label, sentiment_score, signal, confidence,
        )

        return SentimentData(
            symbol=symbol,
            headlines=headlines,
            sentiment_score=round(sentiment_score, 2),
            sentiment_label=sentiment_label,
            key_themes=key_themes[:5],
            signal=signal,
            confidence=round(confidence, 2),
            reasoning=reasoning,
        )

    except Exception as exc:
        logger.error("Sentiment LLM call failed for %s: %s", symbol, exc)
        return _neutral_defaults(symbol, headlines)
