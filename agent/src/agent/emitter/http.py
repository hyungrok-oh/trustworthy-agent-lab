"""HTTP trace emitter — pushes StepTrace to the eval server.

Production emitter. Mirrors the OpenTelemetry collector pattern:
agent instruments itself → pushes spans to collector.

If the eval server is unreachable, the error is logged but the agent
continues normally. Trace loss is acceptable; agent failure is not.
"""

from __future__ import annotations

import logging

import httpx

from agent.core.trace import StepTrace

logger = logging.getLogger(__name__)


class HttpTraceEmitter:
    """Push traces to eval server via HTTP POST."""

    def __init__(self, *, eval_base_url: str) -> None:
        self._base_url = eval_base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(10.0),
        )

    async def emit(self, step: StepTrace) -> None:
        """Push a single step to the eval server."""
        try:
            response = await self._client.post(
                "/api/traces",
                json=step.model_dump(mode="json"),
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Failed to emit trace step: %s", e)

    async def flush(self, trace_id: str) -> None:
        """Signal trace completion to eval server."""
        try:
            response = await self._client.post(
                f"/api/traces/{trace_id}/flush",
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Failed to flush trace: %s", e)

    async def close(self) -> None:
        await self._client.aclose()
