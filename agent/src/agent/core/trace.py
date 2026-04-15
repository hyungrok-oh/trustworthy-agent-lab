"""StepTrace and related types for step-level traceability.

Every execution step of the agent must produce a StepTrace.
This is Principle 4: Every step must be independently evaluable.

HTC feature families mapped to signal types:
    - DynamicsSignal  → Cross-Step Dynamics (macro)
    - StabilitySignal → Intra-Step Stability (micro)
    - is_first/is_last → Positional Indicators
    - step_id/duration_ms → Structure Attributes
    - logprobs → Raw signal source for all families

Reference: research/principles/trustworthy-agent-design.md
Reference: Agentic Confidence Calibration (arXiv:2601.15778)
"""

from __future__ import annotations

import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class StepType(StrEnum):
    """Classification of execution step types."""

    LLM_CALL = "llm_call"
    WORKFLOW = "workflow"
    DECISION = "decision"
    TOOL_CALL = "tool_call"


class StepError(BaseModel):
    """Structured error for a failed step.

    failure_category follows AgentHallu taxonomy:
    planning | retrieval | reasoning | tool_use | context | output
    """

    code: str
    message: str
    failure_category: str


class DynamicsSignal(BaseModel):
    """Cross-step dynamics — macro-level temporal evolution.

    Maps to HTC "Cross-Step Dynamics" feature family.
    Tracks how confidence changes BETWEEN steps.
    """

    confidence_delta: float = Field(description="Change vs previous step")
    trend: str = Field(description="increasing | stable | dropping")


class StabilitySignal(BaseModel):
    """Intra-step stability — micro-level distribution characteristics.

    Maps to HTC "Intra-Step Stability" feature family.
    Tracks consistency WITHIN a single step.
    """

    output_consistency: float = Field(ge=0.0, le=1.0)


class AnomalySignal(BaseModel):
    """Anomaly detected in this step.

    Based on TrajAD trajectory anomaly detection.
    """

    type: str
    severity: str = Field(description="low | medium | high")
    description: str


class StepTrace(BaseModel):
    """Record of a single execution step.

    Every LLM call, workflow transition, and decision must produce one.
    No LLM call without a StepTrace — this is non-negotiable.
    """

    trace_id: str
    step_id: int
    step_type: StepType
    is_first: bool
    is_last: bool

    input: dict[str, Any]
    output: dict[str, Any]
    error: StepError | None = None

    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str

    dynamics: DynamicsSignal
    stability: StabilitySignal

    anomaly: AnomalySignal | None = None

    started_at: datetime
    duration_ms: float

    logprobs: list[list[float]] | None = None


class TraceContext:
    """Manages trace state for a single request lifecycle.

    Creates a unique trace_id and auto-increments step_id.
    One TraceContext per user request.
    """

    def __init__(self) -> None:
        self.trace_id: str = str(uuid.uuid4())
        self._step_counter: int = 0

    def next_step_id(self) -> int:
        current = self._step_counter
        self._step_counter += 1
        return current
