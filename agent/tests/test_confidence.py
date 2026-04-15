from datetime import datetime, timezone

from agent.core.confidence import judge_confidence
from agent.core.trace import (
    DynamicsSignal,
    StabilitySignal,
    StepTrace,
    StepType,
)


def _make_step(confidence: float) -> StepTrace:
    """Helper to create a minimal StepTrace with given confidence."""
    return StepTrace(
        trace_id="test",
        step_id=0,
        step_type=StepType.LLM_CALL,
        is_first=True,
        is_last=True,
        input={"prompt": "test"},
        output={"response": "test"},
        confidence=confidence,
        reasoning="test",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=1.0),
        started_at=datetime.now(timezone.utc),
        duration_ms=100.0,
    )


def test_confident_response() -> None:
    """Confidence >= 0.80 returns confident status."""
    step = _make_step(0.85)
    response = judge_confidence(
        trace_id="test-001",
        answer="The answer is 42.",
        steps=[step],
        final_confidence=0.85,
    )
    assert response.status == "confident"
    assert response.answer == "The answer is 42."
    assert response.caveat is None
    assert response.uncertainty is None


def test_hedged_response() -> None:
    """Confidence between 0.50 and 0.80 returns hedged with caveat."""
    step = _make_step(0.65)
    response = judge_confidence(
        trace_id="test-002",
        answer="Probably 42.",
        steps=[step],
        final_confidence=0.65,
    )
    assert response.status == "hedged"
    assert response.answer == "Probably 42."
    assert response.caveat is not None
    assert response.uncertainty is None


def test_uncertain_response() -> None:
    """Confidence below 0.50 returns uncertain with UncertainInfo."""
    step = _make_step(0.3)
    response = judge_confidence(
        trace_id="test-003",
        answer="Maybe 42?",
        steps=[step],
        final_confidence=0.3,
    )
    assert response.status == "uncertain"
    assert response.answer is None
    assert response.uncertainty is not None
    assert response.uncertainty.reason != ""
    assert response.uncertainty.suggested_action != ""


def test_boundary_confident() -> None:
    """Exactly 0.80 is confident."""
    step = _make_step(0.80)
    response = judge_confidence(
        trace_id="test-004",
        answer="42",
        steps=[step],
        final_confidence=0.80,
    )
    assert response.status == "confident"


def test_boundary_hedged() -> None:
    """Exactly 0.50 is hedged."""
    step = _make_step(0.50)
    response = judge_confidence(
        trace_id="test-005",
        answer="42",
        steps=[step],
        final_confidence=0.50,
    )
    assert response.status == "hedged"
