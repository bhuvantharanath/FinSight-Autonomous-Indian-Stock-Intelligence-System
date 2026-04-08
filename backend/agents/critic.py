"""
FinSight — Critic Agent.
Challenges bullish synthesis outputs and applies a confidence penalty
when downside risks are compelling.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

import httpx

from backend.models.schemas import CriticResult, SynthesisResult

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
CRITIC_MODEL = os.getenv("CRITIC_MODEL", "anthropic/claude-haiku-4-5")

_SYSTEM_PROMPT = (
    "You are a devil's advocate. Given this bullish analysis, identify the 3 strongest "
    "reasons this could be WRONG. Be specific to the data provided."
)

_BONUS_KEYWORDS = ("debt", "leverage", "overvalued")


class CriticAgent:
    """Second-pass skeptic that stress-tests bullish synthesis calls."""

    @staticmethod
    def _should_challenge(synthesis_result: SynthesisResult) -> bool:
        return (
            synthesis_result.final_verdict == "BUY"
            and synthesis_result.weighted_score > 0.2
        )

    @staticmethod
    def _serialize_context(agent_outputs: dict[str, Any]) -> dict[str, Any]:
        serialized: dict[str, Any] = {}
        for name, output in agent_outputs.items():
            if hasattr(output, "model_dump"):
                serialized[name] = output.model_dump()
            else:
                serialized[name] = output
        return serialized

    @staticmethod
    def _extract_challenges(raw_content: str) -> list[str]:
        try:
            parsed = json.loads(raw_content)
            if isinstance(parsed, dict):
                challenges = parsed.get("challenges", [])
            else:
                challenges = parsed

            if isinstance(challenges, list):
                cleaned = [str(item).strip() for item in challenges if str(item).strip()]
                return cleaned[:3]
        except Exception:
            pass

        # Fallback parser for bullet-like plain text responses.
        lines = [line.strip(" -*0123456789.\t") for line in raw_content.splitlines()]
        cleaned_lines = [line.strip() for line in lines if len(line.strip()) > 10]
        return cleaned_lines[:3]

    @staticmethod
    def _compute_penalty(challenges: list[str]) -> float:
        if not challenges:
            return 0.0

        if len(challenges) == 1:
            penalty = 0.04
        elif len(challenges) == 2:
            penalty = 0.07
        else:
            penalty = 0.10

        joined = " ".join(challenges).lower()
        if any(keyword in joined for keyword in _BONUS_KEYWORDS):
            penalty += 0.05

        return round(min(max(penalty, 0.0), 0.15), 2)

    async def _call_openrouter(
        self,
        symbol: str,
        context_payload: dict[str, Any],
    ) -> list[str]:
        if not OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY not set - critic skipped for %s", symbol)
            return []

        user_prompt = (
            f"Symbol: {symbol}\n"
            "Return ONLY valid JSON with this exact shape: "
            "{\"challenges\": [\"...\", \"...\", \"...\"]}.\n"
            "Each challenge must be specific to the supplied data.\n\n"
            f"Full agent outputs:\n{json.dumps(context_payload, ensure_ascii=True)}"
        )

        payload = {
            "model": CRITIC_MODEL,
            "messages": [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.1,
            "max_tokens": 500,
        }
        headers = {
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{OPENROUTER_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()

        # Strip markdown fences if present.
        if content.startswith("```"):
            lines = content.split("\n")
            content = "\n".join(
                line for line in lines if not line.strip().startswith("```")
            )

        return self._extract_challenges(content)

    async def run(
        self,
        symbol: str,
        synthesis_result: SynthesisResult,
        agent_outputs: dict[str, Any],
    ) -> CriticResult:
        """
        Challenge bullish synthesis outputs and return confidence penalty.

        If synthesis is not strongly bullish (weighted_score <= 0.2), returns
        a no-op penalty.
        """
        if not self._should_challenge(synthesis_result):
            return CriticResult(symbol=symbol, challenges=[], confidence_penalty=0.0)

        challenges: list[str] = []
        try:
            context_payload = self._serialize_context(agent_outputs)
            challenges = await self._call_openrouter(symbol, context_payload)
        except Exception as exc:
            logger.error("Critic LLM call failed for %s: %s", symbol, exc)

        penalty = self._compute_penalty(challenges)
        return CriticResult(
            symbol=symbol,
            challenges=challenges,
            confidence_penalty=penalty,
        )


_critic_agent = CriticAgent()


async def run(
    symbol: str,
    synthesis_result: SynthesisResult,
    agent_outputs: dict[str, Any],
) -> CriticResult:
    """Module-level entry point matching other agent modules."""
    return await _critic_agent.run(symbol, synthesis_result, agent_outputs)
