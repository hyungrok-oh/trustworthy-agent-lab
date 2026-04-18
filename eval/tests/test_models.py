from datetime import datetime, timezone

from eval.core.models import (
    StepTraceReceived,
    TraceFlushRequest,
)


def test_step_trace_received_from_json() -> None:
    """Verify we can deserialize a StepTrace from agent's JSON."""
    raw = {
        "trace_id": "abc-123",
        "step_id": 0,
        "step_type": "llm_call",
        "is_first": True,
        "is_last": True,
        "input": {"prompt": "hello"},
        "output": {"response": "hi"},
        "confidence": 0.85,
        "reasoning": "test",
        "dynamics": {"confidence_delta": 0.0, "trend": "stable"},
        "stability": {"output_consistency": 1.0},
        "started_at": datetime.now(timezone.utc).isoformat(),
        "duration_ms": 100.0,
        "logprobs": [[-0.1, -0.3], [-0.2]],
    }
    trace = StepTraceReceived.model_validate(raw)
    assert trace.trace_id == "abc-123"
    assert trace.step_type == "llm_call"
    assert trace.logprobs is not None


def test_step_trace_received_without_optional_fields() -> None:
    raw = {
        "trace_id": "abc-456",
        "step_id": 0,
        "step_type": "llm_call",
        "is_first": True,
        "is_last": True,
        "input": {},
        "output": {},
        "confidence": 0.5,
        "reasoning": "test",
        "dynamics": {"confidence_delta": 0.0, "trend": "stable"},
        "stability": {"output_consistency": 0.8},
        "started_at": datetime.now(timezone.utc).isoformat(),
        "duration_ms": 50.0,
    }
    trace = StepTraceReceived.model_validate(raw)
    assert trace.error is None
    assert trace.anomaly is None
    assert trace.logprobs is None


def test_trace_flush_request() -> None:
    req = TraceFlushRequest(trace_id="abc-123")
    assert req.trace_id == "abc-123"
