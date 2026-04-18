from datetime import UTC, datetime

from eval.core.metrics import compute_step_metrics
from eval.core.models import DynamicsSignal, StabilitySignal, StepError, StepTraceReceived


def _make_trace(
    confidence: float = 0.85,
    duration_ms: float = 100.0,
    has_error: bool = False,
) -> StepTraceReceived:
    return StepTraceReceived(
        trace_id="test-001",
        step_id=0,
        step_type="llm_call",
        is_first=True,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi"} if not has_error else {},
        confidence=confidence,
        reasoning="test",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=0.9),
        error=StepError(code="fail", message="oops", failure_category="reasoning")
        if has_error
        else None,
        started_at=datetime.now(UTC),
        duration_ms=duration_ms,
    )


def test_step_metrics_success() -> None:
    trace = _make_trace(confidence=0.85, duration_ms=150.0)
    metrics = compute_step_metrics(trace)
    assert metrics.success is True
    assert metrics.confidence == 0.85
    assert metrics.duration_ms == 150.0
    assert metrics.failure_category is None


def test_step_metrics_failure() -> None:
    trace = _make_trace(has_error=True, confidence=0.0)
    metrics = compute_step_metrics(trace)
    assert metrics.success is False
    assert metrics.failure_category == "reasoning"


def test_step_metrics_confidence_level() -> None:
    assert compute_step_metrics(_make_trace(confidence=0.9)).confidence_level == "confident"
    assert compute_step_metrics(_make_trace(confidence=0.65)).confidence_level == "hedged"
    assert compute_step_metrics(_make_trace(confidence=0.3)).confidence_level == "uncertain"
