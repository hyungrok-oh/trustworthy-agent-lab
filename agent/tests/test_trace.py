from datetime import UTC, datetime

from agent.core.trace import (
    AnomalySignal,
    DynamicsSignal,
    StabilitySignal,
    StepError,
    StepTrace,
    StepType,
    TraceContext,
)


def test_trace_context_generates_unique_trace_id() -> None:
    ctx1 = TraceContext()
    ctx2 = TraceContext()
    assert ctx1.trace_id != ctx2.trace_id


def test_trace_context_increments_step_id() -> None:
    ctx = TraceContext()
    assert ctx.next_step_id() == 0
    assert ctx.next_step_id() == 1
    assert ctx.next_step_id() == 2


def test_step_trace_minimal() -> None:
    trace = StepTrace(
        trace_id="test-trace-001",
        step_id=0,
        step_type=StepType.LLM_CALL,
        is_first=True,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi there"},
        confidence=0.85,
        reasoning="direct answer, high certainty",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=1.0),
        started_at=datetime.now(UTC),
        duration_ms=150.0,
    )
    assert trace.step_type == StepType.LLM_CALL
    assert trace.confidence == 0.85
    assert trace.error is None
    assert trace.anomaly is None
    assert trace.logprobs is None


def test_step_trace_with_error() -> None:
    trace = StepTrace(
        trace_id="test-trace-002",
        step_id=0,
        step_type=StepType.LLM_CALL,
        is_first=True,
        is_last=True,
        input={"prompt": "hello"},
        output={},
        confidence=0.0,
        reasoning="LLM call failed",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=0.0),
        error=StepError(
            code="llm_failure",
            message="connection timeout",
            failure_category="reasoning",
        ),
        started_at=datetime.now(UTC),
        duration_ms=30000.0,
    )
    assert trace.error is not None
    assert trace.error.failure_category == "reasoning"


def test_step_trace_with_logprobs() -> None:
    trace = StepTrace(
        trace_id="test-trace-003",
        step_id=0,
        step_type=StepType.LLM_CALL,
        is_first=True,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi"},
        confidence=0.9,
        reasoning="high confidence tokens",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=0.95),
        logprobs=[[-0.1, -0.5, -0.3], [-0.2, -0.4]],
        started_at=datetime.now(UTC),
        duration_ms=100.0,
    )
    assert trace.logprobs is not None
    assert len(trace.logprobs) == 2


def test_step_trace_serializes_to_json() -> None:
    trace = StepTrace(
        trace_id="test-trace-004",
        step_id=0,
        step_type=StepType.LLM_CALL,
        is_first=True,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi"},
        confidence=0.85,
        reasoning="test",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=1.0),
        started_at=datetime.now(UTC),
        duration_ms=100.0,
    )
    data = trace.model_dump(mode="json")
    assert data["step_type"] == "llm_call"
    assert isinstance(data["started_at"], str)


def test_anomaly_signal() -> None:
    anomaly = AnomalySignal(
        type="confidence_spike",
        severity="high",
        description="sudden confidence increase without supporting evidence",
    )
    assert anomaly.severity == "high"
