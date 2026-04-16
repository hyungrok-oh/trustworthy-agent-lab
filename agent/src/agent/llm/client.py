"""OpenAI-compatible LLM client with logprobs support.

Calls llm-serving's vllm-mlx endpoint at /v1/chat/completions.
Collects token-level log-probabilities for HTC feature extraction.

Why logprobs matter:
    HTC's 48-dimensional feature vector is derived from token-level
    log-probabilities across the agent's trajectory. Without logprobs,
    we can only use coarse signals (response time, text length).
    With logprobs, we get the raw material for all 4 HTC feature families.

Reference: Agentic Confidence Calibration (arXiv:2601.15778)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMResponse:
    """Parsed response from the LLM server."""

    text: str
    logprobs: list[list[float]] | None
    prompt_tokens: int
    completion_tokens: int
    finish_reason: str


class LLMClient:
    """Async HTTP client for OpenAI-compatible LLM API.

    Designed for llm-serving's vllm-mlx endpoint.
    Always requests logprobs for HTC analysis.
    """

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        temperature: float = 0.0,
        timeout_seconds: int = 60,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._temperature = temperature
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(timeout_seconds),
        )

    def _build_request_body(
        self, messages: list[dict[str, str]]
    ) -> dict[str, Any]:
        return {
            "model": self._model,
            "messages": messages,
            "temperature": self._temperature,
            "logprobs": True,
            "top_logprobs": 5,
        }

    async def chat(
        self, messages: list[dict[str, str]]
    ) -> LLMResponse:
        """Send chat completion request and parse response with logprobs."""
        body = self._build_request_body(messages)

        response = await self._client.post(
            "/v1/chat/completions",
            json=body,
        )
        response.raise_for_status()
        data = response.json()

        choice = data["choices"][0]
        text = choice["message"]["content"]
        finish_reason = choice.get("finish_reason", "stop")

        logprobs = self._extract_logprobs(choice)

        usage = data.get("usage", {})

        return LLMResponse(
            text=text,
            logprobs=logprobs,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            finish_reason=finish_reason,
        )

    def _extract_logprobs(
        self, choice: dict[str, Any]
    ) -> list[list[float]] | None:
        """Extract token-level log-probabilities from response.

        OpenAI-compatible format:
        {
            "logprobs": {
                "content": [
                    {"token": "Hello", "logprob": -0.1, "top_logprobs": [
                        {"token": "Hello", "logprob": -0.1},
                        {"token": "Hi", "logprob": -0.5},
                    ]},
                    ...
                ]
            }
        }

        Returns: list of lists — outer = tokens, inner = top-k logprobs.
        """
        raw = choice.get("logprobs")
        if raw is None:
            return None

        content_tokens = raw.get("content")
        if content_tokens is None:
            return None

        result: list[list[float]] = []
        for token_info in content_tokens:
            top_logprobs = token_info.get("top_logprobs", [])
            result.append([lp.get("logprob", 0.0) for lp in top_logprobs])

        return result if result else None

    async def close(self) -> None:
        await self._client.aclose()
