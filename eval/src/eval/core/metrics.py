"""Step-level metrics computation.

Phase 1: basic metrics (success/fail, confidence level, duration).
Phase 2+: HTC 48-dim feature extraction, calibration.

Uses the same confidence thresholds as the agent server to ensure
consistent classification across the system.
"""

from __future__ import annotations

from dataclasses import dataclass

from eval.core.models import StepTraceReceived

CONFIDENCE_THRESHOLD_CERTAIN: float = 0.80
CONFIDENCE_THRESHOLD_HEDGED: float = 0.50


@dataclass(frozen=True)
class StepMetrics:
    """Computed metrics for a single step.

    Internal data structure — not sent over HTTP.
    Using @dataclass instead of BaseModel for performance (no validation needed).
    """

    step_id: int
    step_type: str
    success: bool
    confidence: float
    confidence_level: str  # confident | hedged | uncertain
    duration_ms: float
    failure_category: str | None


def compute_step_metrics(trace: StepTraceReceived) -> StepMetrics:
    """Compute basic step-level metrics from a received trace."""
    success = trace.error is None

    if trace.confidence >= CONFIDENCE_THRESHOLD_CERTAIN:
        confidence_level = "confident"
    elif trace.confidence >= CONFIDENCE_THRESHOLD_HEDGED:
        confidence_level = "hedged"
    else:
        confidence_level = "uncertain"

    return StepMetrics(
        step_id=trace.step_id,
        step_type=trace.step_type,
        success=success,
        confidence=trace.confidence,
        confidence_level=confidence_level,
        duration_ms=trace.duration_ms,
        failure_category=trace.error.failure_category if trace.error else None,
    )
