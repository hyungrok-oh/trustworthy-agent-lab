"""Trace receiver — collects StepTrace data pushed by the agent.

When TraceRepository is provided, traces are persisted to MongoDB.
Otherwise, falls back to in-memory buffering (Phase 1 behavior).

Phase 1.5: async methods + MongoDB persistence.
"""

from __future__ import annotations

import logging
from collections import defaultdict

from eval.core.metrics import StepMetrics, compute_step_metrics
from eval.core.models import StepTraceReceived
from eval.reporter.console import ConsoleReporter
from eval.repository.trace import TraceRepository

logger = logging.getLogger(__name__)


class TraceReceiver:
    """Receives and buffers traces, computes metrics on flush.

    With repo: steps are persisted to MongoDB (survives restarts).
    Without repo: steps are buffered in memory (Phase 1 fallback).
    """

    def __init__(self, *, repo: TraceRepository | None = None) -> None:
        self._buffers: dict[str, list[StepTraceReceived]] = defaultdict(list)
        self._repo = repo
        self._reporter = ConsoleReporter()

    async def receive(self, step: StepTraceReceived) -> None:
        """Buffer or persist a received step trace."""
        if self._repo:
            await self._repo.save_step(step)
        else:
            self._buffers[step.trace_id].append(step)
        logger.info(
            "Received step: trace_id=%s step_id=%d type=%s confidence=%.2f",
            step.trace_id,
            step.step_id,
            step.step_type,
            step.confidence,
        )

    async def flush(self, trace_id: str) -> list[StepMetrics]:
        """Process all buffered steps for a trace and compute metrics."""
        if self._repo:
            steps = await self._repo.get_steps(trace_id)
            if steps:
                await self._repo.mark_analyzed(trace_id)
        else:
            steps = self._buffers.pop(trace_id, [])

        if not steps:
            logger.warning("Flush called for unknown trace: %s", trace_id)
            return []

        steps.sort(key=lambda s: s.step_id)
        metrics = [compute_step_metrics(step) for step in steps]
        self._reporter.report(trace_id, metrics)
        return metrics
