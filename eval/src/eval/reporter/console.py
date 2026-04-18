"""Console reporter — prints step-level metrics to terminal.

Phase 1: structured log output.
Phase 2+: web dashboard, JSON export.
"""

from __future__ import annotations

import logging

from eval.core.metrics import StepMetrics

logger = logging.getLogger(__name__)


class ConsoleReporter:
    """Outputs evaluation results to the terminal."""

    def report(self, trace_id: str, metrics: list[StepMetrics]) -> None:
        total = len(metrics)
        successes = sum(1 for m in metrics if m.success)
        avg_confidence = (
            sum(m.confidence for m in metrics) / total if total > 0 else 0.0
        )
        total_duration = sum(m.duration_ms for m in metrics)

        logger.info("=" * 60)
        logger.info("TRACE EVALUATION: %s", trace_id)
        logger.info("-" * 60)
        logger.info(
            "Steps: %d | Success: %d/%d | Avg Confidence: %.2f",
            total, successes, total, avg_confidence,
        )
        logger.info("Total Duration: %.1f ms", total_duration)

        for m in metrics:
            status = "OK" if m.success else f"FAIL ({m.failure_category})"
            logger.info(
                "  Step %d [%s]: %s | confidence=%.2f (%s) | %.1f ms",
                m.step_id,
                m.step_type,
                status,
                m.confidence,
                m.confidence_level,
                m.duration_ms,
            )
        logger.info("=" * 60)
