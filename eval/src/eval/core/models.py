"""Received StepTrace models — mirrors agent's types for the HTTP contract.

These are independent from agent's types to avoid coupling.
The interface is the JSON schema, not a shared Python package.

Why duplicate instead of sharing?
    - Agent and Eval are separate deployable services
    - Could be rewritten in different languages
    - JSON schema is the contract, not Python classes
    - Avoids version coupling between services
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class DynamicsSignal(BaseModel):
    confidence_delta: float
    trend: str


class StabilitySignal(BaseModel):
    output_consistency: float


class StepError(BaseModel):
    code: str
    message: str
    failure_category: str


class AnomalySignal(BaseModel):
    type: str
    severity: str
    description: str


class StepTraceReceived(BaseModel):
    """A step trace received from the agent server."""

    trace_id: str
    step_id: int
    step_type: str
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


class TraceFlushRequest(BaseModel):
    trace_id: str
