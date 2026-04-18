from datetime import UTC, datetime

from eval.collector.receiver import TraceReceiver
from eval.core.models import DynamicsSignal, StabilitySignal, StepTraceReceived


def _make_step(trace_id: str, step_id: int, confidence: float = 0.85) -> StepTraceReceived:
    return StepTraceReceived(
        trace_id=trace_id,
        step_id=step_id,
        step_type="llm_call",
        is_first=step_id == 0,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi"},
        confidence=confidence,
        reasoning="test",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=0.9),
        started_at=datetime.now(UTC),
        duration_ms=100.0,
    )


def test_receiver_buffers_and_flushes() -> None:
    receiver = TraceReceiver()
    receiver.receive(_make_step("trace-001", 0))
    receiver.receive(_make_step("trace-001", 1))

    metrics = receiver.flush("trace-001")
    assert len(metrics) == 2
    assert metrics[0].step_id == 0
    assert metrics[1].step_id == 1


def test_receiver_flush_unknown_trace() -> None:
    receiver = TraceReceiver()
    metrics = receiver.flush("nonexistent")
    assert metrics == []


def test_receiver_isolates_traces() -> None:
    receiver = TraceReceiver()
    receiver.receive(_make_step("trace-A", 0))
    receiver.receive(_make_step("trace-B", 0))

    metrics_a = receiver.flush("trace-A")
    metrics_b = receiver.flush("trace-B")
    assert len(metrics_a) == 1
    assert len(metrics_b) == 1
