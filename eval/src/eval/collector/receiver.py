"""Trace receiver — collects StepTrace data pushed by the agent.

Buffers steps per trace_id in memory, then processes on flush.
Phase 1.5 will add MongoDB persistence.
"""

from __future__ import annotations

import logging
from collections import defaultdict

from eval.core.metrics import StepMetrics, compute_step_metrics
from eval.core.models import StepTraceReceived
from eval.reporter.console import ConsoleReporter

logger = logging.getLogger(__name__)


class TraceReceiver:
    """Receives and buffers traces, computes metrics on flush."""

    def __init__(self) -> None:
        self._buffers: dict[str, list[StepTraceReceived]] = defaultdict(list)
        self._reporter = ConsoleReporter()

    def receive(self, step: StepTraceReceived) -> None:
        """Buffer a received step trace."""
        self._buffers[step.trace_id].append(step)
        logger.info(
            "Received step: trace_id=%s step_id=%d type=%s confidence=%.2f",
            step.trace_id,
            step.step_id,
            step.step_type,
            step.confidence,
        )

    def flush(self, trace_id: str) -> list[StepMetrics]:
        """Process all buffered steps for a trace and compute metrics."""
        steps = self._buffers.pop(trace_id, [])
        if not steps:
            logger.warning("Flush called for unknown trace: %s", trace_id)
            return []

        steps.sort(key=lambda s: s.step_id)
        metrics = [compute_step_metrics(step) for step in steps]
        self._reporter.report(trace_id, metrics)
        return metrics
