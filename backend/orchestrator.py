"""
FinSight — Orchestrator.
Coordinates all specialist agents for each analysis run and persists
intermediate outputs for real-time SSE streaming.
"""

from __future__ import annotations

import asyncio
import logging
import traceback

from backend.agents import (
    data_ingestion,
    eda_agent,
    fundamental,
    ml_agent,
    risk,
    sentiment,
    synthesis,
    technical,
)
from backend.database import save_agent_output, save_synthesis_result, update_run_status
from backend.models.schemas import MLPrediction, OHLCVData

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────
def _save_success(run_id: str, symbol: str, agent_name: str, result) -> None:
    """Persist a successful agent output to the database."""
    signal = getattr(result, "signal", None)
    confidence = getattr(result, "confidence", None)
    if confidence is None:
        confidence = getattr(result, "prediction_confidence", None)
    reasoning = getattr(result, "reasoning", None)

    if agent_name == "data_ingestion":
        signal = None
        confidence = None
        reasoning = (
            f"Fetched {len(result.dates)} days of data. "
            f"Current: Rs.{result.current_price} ({result.change_pct:+.2f}%)"
        )
    elif agent_name == "eda":
        signal = None
        confidence = None
        reasoning = (
            f"Generated multi-stock EDA for {len(getattr(result, 'symbols', []))} symbols."
        )

    data_dict = result.model_dump() if hasattr(result, "model_dump") else None

    save_agent_output(
        run_id=run_id,
        symbol=symbol,
        agent_name=agent_name,
        status="completed",
        signal=signal,
        confidence=confidence,
        reasoning=reasoning,
        data_dict=data_dict,
    )


def _save_failure(run_id: str, symbol: str, agent_name: str, error: str) -> None:
    """Persist a failed agent output to the database."""
    save_agent_output(
        run_id=run_id,
        symbol=symbol,
        agent_name=agent_name,
        status="failed",
        signal=None,
        confidence=None,
        reasoning=f"Agent failed: {error}",
        data_dict=None,
    )


def _mark_symbol_downstream_failed(run_id: str, symbol: str, reason: str) -> None:
    """Mark all downstream per-symbol agents as failed."""
    for agent_name in (
        "technical",
        "fundamental",
        "sentiment",
        "risk",
        "ml_prediction",
        "synthesis",
    ):
        _save_failure(run_id, symbol, agent_name, reason)


# ──────────────────────────────────────────────────────────────────────
# Run stages
# ──────────────────────────────────────────────────────────────────────
async def _run_data_ingestion_stage(
    run_id: str,
    symbols: list[str],
) -> dict[str, OHLCVData]:
    """
    Stage 1: fetch OHLCV data for all symbols.
    Kept sequential to avoid overwhelming upstream rate limits.
    """
    ohlcv_dict: dict[str, OHLCVData] = {}

    for symbol in symbols:
        try:
            ohlcv = await data_ingestion.run(symbol)
            ohlcv_dict[symbol] = ohlcv
            _save_success(run_id, symbol, "data_ingestion", ohlcv)
            logger.info("✓ %s data_ingestion complete (%d rows)", symbol, len(ohlcv.dates))
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ %s data_ingestion FAILED: %s", symbol, error_msg)
            _save_failure(run_id, symbol, "data_ingestion", error_msg)
            _mark_symbol_downstream_failed(
                run_id,
                symbol,
                f"Skipped - data ingestion failed: {error_msg}",
            )

    return ohlcv_dict


async def _run_eda_and_ml_stage(
    run_id: str,
    symbols: list[str],
    ohlcv_dict: dict[str, OHLCVData],
) -> dict[str, MLPrediction | None]:
    """
    Stage 2 (parallel):
    1) Run multi-stock EDA once for the run and persist as agent output "eda".
    2) Run per-symbol ML predictions and persist each as "ml_prediction".
    """
    ml_predictions: dict[str, MLPrediction | None] = {symbol: None for symbol in symbols}

    async def _run_eda() -> None:
        try:
            eda_result = await eda_agent.run(run_id, symbols, ohlcv_dict)
            # Run-level output row uses symbol="ALL".
            _save_success(run_id, "ALL", "eda", eda_result)
            logger.info("✓ run %s eda complete (%d symbols)", run_id, len(symbols))
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ run %s eda FAILED: %s", run_id, error_msg)
            _save_failure(run_id, "ALL", "eda", error_msg)

    async def _run_ml_batch() -> None:
        ml_tasks = [
            ml_agent.run(symbol, ohlcv_dict[symbol])
            for symbol in symbols
        ]
        ml_results = await asyncio.gather(*ml_tasks, return_exceptions=True)

        for symbol, ml_result in zip(symbols, ml_results):
            if isinstance(ml_result, Exception):
                error_msg = f"{type(ml_result).__name__}: {ml_result}"
                logger.error("✗ %s ml_prediction FAILED: %s", symbol, error_msg)
                _save_failure(run_id, symbol, "ml_prediction", error_msg)
                continue

            ml_predictions[symbol] = ml_result
            _save_success(run_id, symbol, "ml_prediction", ml_result)
            logger.info(
                "✓ %s ml_prediction: %s (%.0f%%)",
                symbol,
                ml_result.signal,
                ml_result.prediction_confidence * 100,
            )

    await asyncio.gather(_run_eda(), _run_ml_batch())
    return ml_predictions


async def _run_symbol_analysis_stage(
    run_id: str,
    symbol: str,
    ohlcv: OHLCVData,
    ml_prediction: MLPrediction | None,
) -> None:
    """
    Stage 3 (per symbol):
    technical + fundamental + sentiment + risk in parallel,
    followed by synthesis with ML prediction context.
    """
    tech_result = None
    fund_result = None
    sent_result = None
    risk_result = None

    async def _run_technical() -> None:
        nonlocal tech_result
        try:
            tech_result = await technical.run(symbol, ohlcv)
            _save_success(run_id, symbol, "technical", tech_result)
            logger.info("✓ %s technical: %s (%.0f%%)", symbol, tech_result.signal, tech_result.confidence * 100)
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ %s technical FAILED: %s", symbol, error_msg)
            _save_failure(run_id, symbol, "technical", error_msg)

    async def _run_fundamental() -> None:
        nonlocal fund_result
        try:
            fund_result = await fundamental.run(symbol, ohlcv)
            _save_success(run_id, symbol, "fundamental", fund_result)
            logger.info("✓ %s fundamental: %s (%.0f%%)", symbol, fund_result.signal, fund_result.confidence * 100)
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ %s fundamental FAILED: %s", symbol, error_msg)
            _save_failure(run_id, symbol, "fundamental", error_msg)

    async def _run_sentiment() -> None:
        nonlocal sent_result
        try:
            sent_result = await sentiment.run(symbol)
            _save_success(run_id, symbol, "sentiment", sent_result)
            logger.info("✓ %s sentiment: %s (%.0f%%)", symbol, sent_result.signal, sent_result.confidence * 100)
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ %s sentiment FAILED: %s", symbol, error_msg)
            _save_failure(run_id, symbol, "sentiment", error_msg)

    async def _run_risk() -> None:
        nonlocal risk_result
        try:
            risk_result = await risk.run(symbol, ohlcv)
            _save_success(run_id, symbol, "risk", risk_result)
            logger.info("✓ %s risk: %s (beta=%.2f)", symbol, risk_result.risk_level, risk_result.beta)
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ %s risk FAILED: %s", symbol, error_msg)
            _save_failure(run_id, symbol, "risk", error_msg)

    await asyncio.gather(
        _run_technical(),
        _run_fundamental(),
        _run_sentiment(),
        _run_risk(),
    )

    if all(r is not None for r in [tech_result, fund_result, sent_result, risk_result, ml_prediction]):
        try:
            synth_result = await synthesis.run(
                symbol,
                tech_result,
                fund_result,
                sent_result,
                risk_result,
                ml_prediction,
            )
            _save_success(run_id, symbol, "synthesis", synth_result)
            save_synthesis_result(run_id, synth_result)
            logger.info(
                "✓ %s synthesis: %s (%.0f%%) target=%+.1f%%",
                symbol,
                synth_result.final_verdict,
                synth_result.overall_confidence * 100,
                synth_result.price_target_pct,
            )
        except Exception as exc:
            error_msg = f"{type(exc).__name__}: {exc}"
            logger.error("✗ %s synthesis FAILED: %s", symbol, error_msg)
            _save_failure(run_id, symbol, "synthesis", error_msg)
    else:
        missing: list[str] = []
        if tech_result is None:
            missing.append("technical")
        if fund_result is None:
            missing.append("fundamental")
        if sent_result is None:
            missing.append("sentiment")
        if risk_result is None:
            missing.append("risk")
        if ml_prediction is None:
            missing.append("ml_prediction")

        error_msg = f"Cannot synthesise - missing agent outputs: {', '.join(missing)}"
        logger.warning("⚠ %s synthesis SKIPPED: %s", symbol, error_msg)
        _save_failure(run_id, symbol, "synthesis", error_msg)


# ──────────────────────────────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────────────────────────────
async def _run_analysis_async(run_id: str, symbols: list[str]) -> None:
    """
    Async entry point.

    Pipeline:
    1) data_ingestion for all symbols
    2) eda + ml_prediction in parallel
    3) technical + fundamental + sentiment + risk per symbol
    4) synthesis per symbol (includes ml_prediction)
    """
    logger.info("▶ Analysis run %s started for symbols: %s", run_id, symbols)

    ohlcv_dict = await _run_data_ingestion_stage(run_id, symbols)
    symbols_with_data = list(ohlcv_dict.keys())

    if not symbols_with_data:
        _save_failure(
            run_id,
            "ALL",
            "eda",
            "Skipped - no symbols available after data ingestion failures",
        )
        update_run_status(run_id, "failed")
        logger.info("■ Analysis run %s finished: failed", run_id)
        return

    ml_predictions = await _run_eda_and_ml_stage(run_id, symbols_with_data, ohlcv_dict)

    for symbol in symbols_with_data:
        try:
            await _run_symbol_analysis_stage(
                run_id,
                symbol,
                ohlcv_dict[symbol],
                ml_predictions.get(symbol),
            )
        except Exception as exc:
            logger.error(
                "Unhandled downstream error for %s in run %s: %s\n%s",
                symbol,
                run_id,
                exc,
                traceback.format_exc(),
            )
            _save_failure(run_id, symbol, "orchestrator", str(exc))

    # Keep historical behavior: run is completed if at least one symbol passed ingestion.
    final_status = "completed" if symbols_with_data else "failed"
    update_run_status(run_id, final_status)
    logger.info("■ Analysis run %s finished: %s", run_id, final_status)


def run_analysis(run_id: str, symbols: list[str]) -> None:
    """
    Synchronous entry point called by FastAPI BackgroundTasks.
    Creates a new event loop to run the async pipeline.
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_run_analysis_async(run_id, symbols))
        finally:
            loop.close()
    except Exception as exc:
        logger.error(
            "Orchestrator crashed for run %s: %s\n%s",
            run_id,
            exc,
            traceback.format_exc(),
        )
        update_run_status(run_id, "failed")
