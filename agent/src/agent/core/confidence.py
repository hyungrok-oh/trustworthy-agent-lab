"""3-tier confidence judgment.

Principle 5: When uncertain, stop and explain — never guess.

HTC qualitative finding: last step confidence was 0.973 but the answer
was wrong. Full trajectory confidence should have been 0.052.
This is why we never trust a single confidence number blindly.

Thresholds:
    >= 0.80  → confident (proceed)
    >= 0.50  → hedged (proceed with warning)
    <  0.50  → uncertain (stop, explain, suggest action)
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from agent.core.trace import StepTrace

CONFIDENCE_THRESHOLD_CERTAIN: float = 0.80
CONFIDENCE_THRESHOLD_HEDGED: float = 0.50


class UncertainInfo(BaseModel):
    """Structured explanation when the agent cannot answer confidently.

    Instead of guessing, the agent explains:
    - Why it's uncertain
    - What it does know
    - What action the user should take
    """

    reason: str
    what_i_know: str
    suggested_action: str


class ResponseStatus:
    CONFIDENT = "confident"
    HEDGED = "hedged"
    UNCERTAIN = "uncertain"


class AgentResponse(BaseModel):
    """Final response from the agent — always includes confidence."""

    trace_id: str
    status: str = Field(description="confident | hedged | uncertain")
    answer: str | None = None

    confidence: float = Field(ge=0.0, le=1.0)
    caveat: str | None = None
    uncertainty: UncertainInfo | None = None

    steps: list[StepTrace]


def judge_confidence(
    *,
    trace_id: str,
    answer: str,
    steps: list[StepTrace],
    final_confidence: float,
) -> AgentResponse:
    """Build AgentResponse based on confidence thresholds.

    This is the decision gate: the agent either proceeds confidently,
    hedges with a warning, or stops and explains why it can't answer.
    """
    if final_confidence >= CONFIDENCE_THRESHOLD_CERTAIN:
        return AgentResponse(
            trace_id=trace_id,
            status=ResponseStatus.CONFIDENT,
            answer=answer,
            confidence=final_confidence,
            steps=steps,
        )

    if final_confidence >= CONFIDENCE_THRESHOLD_HEDGED:
        return AgentResponse(
            trace_id=trace_id,
            status=ResponseStatus.HEDGED,
            answer=answer,
            confidence=final_confidence,
            caveat="This response may require verification. Confidence is moderate.",
            steps=steps,
        )

    # Below threshold — stop and explain (Principle 5)
    return AgentResponse(
        trace_id=trace_id,
        status=ResponseStatus.UNCERTAIN,
        answer=None,
        confidence=final_confidence,
        uncertainty=UncertainInfo(
            reason=f"Confidence too low ({final_confidence:.2f}) to provide a reliable answer.",
            what_i_know=_extract_partial_info(steps),
            suggested_action="Please rephrase your question or provide additional context.",
        ),
        steps=steps,
    )


def _extract_partial_info(steps: list[StepTrace]) -> str:
    """Extract what the agent did learn from the steps, even if insufficient."""
    outputs = [
        step.output.get("response", "")
        for step in steps
        if step.output.get("response")
    ]
    if outputs:
        return (
            f"Partial information gathered from {len(outputs)} step(s), "
            "but confidence is insufficient."
        )
    return "No reliable information could be extracted."
