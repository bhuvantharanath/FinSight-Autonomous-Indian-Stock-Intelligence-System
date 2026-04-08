"""
FinSight — Macro Flow Agent.
Fetches NSE FII/DII activity and derives a market-wide macro signal.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from backend.models.schemas import MacroResult

logger = logging.getLogger(__name__)

NSE_HOME_URL = "https://www.nseindia.com"
NSE_FII_DII_URL = "https://www.nseindia.com/api/fiidiiTradeReact"

NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json",
    "Referer": "https://www.nseindia.com/",
}

_DATE_KEYS = ("date", "tradeDate", "trade_date", "tradingDate")
_FII_BUY_KEYS = ("fiiBuyValue", "fiiBuy", "fii_buy")
_FII_SELL_KEYS = ("fiiSellValue", "fiiSell", "fii_sell")
_FII_NET_KEYS = ("fiiNetValue", "fiiNet", "fii_net")
_DII_BUY_KEYS = ("diiBuyValue", "diiBuy", "dii_buy")
_DII_SELL_KEYS = ("diiSellValue", "diiSell", "dii_sell")
_DII_NET_KEYS = ("diiNetValue", "diiNet", "dii_net")


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)

    text = str(value).strip()
    if not text or text in {"-", "--", "NA", "N/A", "null", "None"}:
        return None

    text = text.replace(",", "")
    try:
        return float(text)
    except ValueError:
        return None


def _pick_float(row: dict[str, Any], keys: tuple[str, ...]) -> float | None:
    for key in keys:
        if key in row:
            parsed = _to_float(row.get(key))
            if parsed is not None:
                return parsed
    return None


def _pick_date(row: dict[str, Any]) -> datetime | None:
    raw_date: Any = None
    for key in _DATE_KEYS:
        if key in row:
            raw_date = row.get(key)
            break

    if raw_date is None:
        return None

    date_text = str(raw_date).strip()
    if not date_text:
        return None

    for fmt in (
        "%d-%b-%Y",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%d %b %Y",
    ):
        try:
            return datetime.strptime(date_text, fmt)
        except ValueError:
            continue

    return None


def _extract_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        data = payload.get("data")
        if isinstance(data, list):
            return [row for row in data if isinstance(row, dict)]
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    return []


def _neutral_result(reason: str) -> MacroResult:
    return MacroResult(
        fii_net_5d=0.0,
        dii_net_5d=0.0,
        macro_signal="NEUTRAL",
        confidence_multiplier=1.0,
        reasoning=reason,
    )


def _derive_macro_result(payload: Any) -> MacroResult:
    rows = _extract_rows(payload)
    if not rows:
        raise ValueError("NSE fiidiiTradeReact returned no rows")

    parsed_days: list[tuple[datetime, float, float]] = []
    for row in rows:
        trade_date = _pick_date(row)
        if trade_date is None:
            continue

        fii_buy = _pick_float(row, _FII_BUY_KEYS)
        fii_sell = _pick_float(row, _FII_SELL_KEYS)
        fii_net = _pick_float(row, _FII_NET_KEYS)

        dii_buy = _pick_float(row, _DII_BUY_KEYS)
        dii_sell = _pick_float(row, _DII_SELL_KEYS)
        dii_net = _pick_float(row, _DII_NET_KEYS)

        if fii_buy is not None and fii_sell is not None:
            fii_day_net = fii_buy - fii_sell
        else:
            fii_day_net = fii_net

        if dii_buy is not None and dii_sell is not None:
            dii_day_net = dii_buy - dii_sell
        else:
            dii_day_net = dii_net

        if fii_day_net is None or dii_day_net is None:
            continue

        parsed_days.append((trade_date, fii_day_net, dii_day_net))

    if not parsed_days:
        raise ValueError("No parseable FII/DII rows in NSE response")

    parsed_days.sort(key=lambda item: item[0], reverse=True)
    recent_days = parsed_days[:5]

    fii_net_5d = sum(day[1] for day in recent_days)
    dii_net_5d = sum(day[2] for day in recent_days)

    if fii_net_5d > 2000:
        macro_signal = "BULLISH"
        confidence_multiplier = 1.1
    elif fii_net_5d < -2000:
        macro_signal = "BEARISH"
        confidence_multiplier = 0.9
    else:
        macro_signal = "NEUTRAL"
        confidence_multiplier = 1.0

    sessions_used = len(recent_days)
    reasoning = (
        f"NSE FII/DII last {sessions_used} sessions: FII net {fii_net_5d:+.2f} Cr, "
        f"DII net {dii_net_5d:+.2f} Cr. "
        f"Macro signal is {macro_signal} with confidence multiplier "
        f"{confidence_multiplier:.1f}."
    )

    return MacroResult(
        fii_net_5d=round(fii_net_5d, 2),
        dii_net_5d=round(dii_net_5d, 2),
        macro_signal=macro_signal,
        confidence_multiplier=confidence_multiplier,
        reasoning=reasoning,
    )


async def run() -> MacroResult:
    """
    Fetch NSE FII/DII activity and derive a 5-day macro flow signal.

    Required NSE flow:
    1) GET nseindia.com homepage to establish cookies.
    2) GET fiidiiTradeReact endpoint with browser-like headers.
    """
    try:
        async with httpx.AsyncClient(
            headers=NSE_HEADERS,
            timeout=20.0,
            follow_redirects=True,
        ) as client:
            home_response = await client.get(NSE_HOME_URL)
            home_response.raise_for_status()

            api_response = await client.get(NSE_FII_DII_URL)
            api_response.raise_for_status()

            payload = api_response.json()

        result = _derive_macro_result(payload)
        logger.info(
            "macro: signal=%s fii_net_5d=%.2f dii_net_5d=%.2f multiplier=%.2f",
            result.macro_signal,
            result.fii_net_5d,
            result.dii_net_5d,
            result.confidence_multiplier,
        )
        return result

    except Exception as exc:
        logger.error("Macro agent failed: %s", exc)
        return _neutral_result(
            "Macro flow unavailable from NSE fiidiiTradeReact. "
            f"Using NEUTRAL macro signal ({type(exc).__name__}: {exc})."
        )
