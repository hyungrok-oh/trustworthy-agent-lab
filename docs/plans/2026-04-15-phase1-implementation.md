# Phase 1: Augmented LLM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the minimal trustworthy agent (StepTrace + confidence) and evaluation receiver, deployable via docker-compose.

**Architecture:** Agent Server receives user messages, calls LLM via llm-serving (OpenAI-compatible API), wraps every call with StepTrace, judges confidence on a 3-tier scale, and pushes traces to Eval Server. Eval Server collects traces and computes basic step-level metrics. MongoDB stores conversation history and traces.

**Tech Stack:** Python 3.13+, uv, FastAPI, Pydantic v2, httpx, motor (MongoDB async), pytest, ruff, Docker

**Network Note:** `uv sync` and `docker compose` commands require network access. These are marked with `[USER]` — the user runs them manually.

---

## File Map

### Agent Server (`agent/`)

| File | Responsibility |
|------|---------------|
| `agent/pyproject.toml` | Package config, dependencies |
| `agent/.python-version` | Python version pin |
| `agent/src/agent/__init__.py` | Package init |
| `agent/src/agent/main.py` | FastAPI app factory, endpoints |
| `agent/src/agent/config.py` | Settings (Pydantic BaseSettings) |
| `agent/src/agent/core/trace.py` | StepTrace, TraceContext, all trace types |
| `agent/src/agent/core/confidence.py` | 3-tier confidence judgment |
| `agent/src/agent/core/context.py` | WorkflowContext (slot separation) |
| `agent/src/agent/llm/client.py` | LLM Server HTTP client (logprobs) |
| `agent/src/agent/emitter/protocol.py` | TraceEmitter Protocol |
| `agent/src/agent/emitter/http.py` | HttpTraceEmitter (push to eval) |
| `agent/src/agent/emitter/file.py` | FileTraceEmitter (local JSON) |
| `agent/src/agent/pipeline/conversation.py` | Conversation pipeline |
| `agent/Dockerfile` | Container image |

> **Deferred to Phase 1.5:** `agent/src/agent/repository/` (MongoDB CRUD). Phase 1 uses in-memory state.

### Eval Server (`eval/`)

| File | Responsibility |
|------|---------------|
| `eval/pyproject.toml` | Package config, dependencies |
| `eval/.python-version` | Python version pin |
| `eval/src/eval/__init__.py` | Package init |
| `eval/src/eval/main.py` | FastAPI app factory, endpoints |
| `eval/src/eval/config.py` | Settings |
| `eval/src/eval/core/models.py` | StepTrace receive models (mirrors agent types) |
| `eval/src/eval/core/metrics.py` | Step-level metric calculations |
| `eval/src/eval/collector/receiver.py` | Trace receive + store logic |
| `eval/src/eval/reporter/console.py` | Terminal report output |
| `eval/Dockerfile` | Container image |

> **Deferred to Phase 1.5:** `eval/src/eval/repository/` (MongoDB CRUD). Phase 1 uses in-memory buffer.

### Root

| File | Responsibility |
|------|---------------|
| `docker-compose.yml` | Orchestrate Agent + Eval + MongoDB |
| `research/` | Moved from root (principles/, radar/, notes/, tracking/) |

---

## Task 1: Project Restructuring

**Files:**
- Move: `principles/` → `research/principles/`
- Move: `radar/` → `research/radar/`
- Move: `notes/` → `research/notes/`
- Move: `tracking/` → `research/tracking/`

- [ ] **Step 1: Create research/ and move directories**

```bash
mkdir -p research
git mv principles/ research/principles/
git mv radar/ research/radar/
git mv notes/ research/notes/
git mv tracking/ research/tracking/
```

- [ ] **Step 2: Verify structure**

Run: `ls -la research/`
Expected: `principles/  radar/  notes/  tracking/`

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move research docs to research/ directory

Separate research materials from code directories.
Principles, radar, notes, and tracking now live under research/."
```

---

## Task 2: Agent Project Scaffold

**Files:**
- Create: `agent/pyproject.toml`
- Create: `agent/.python-version`
- Create: `agent/src/agent/__init__.py`
- Create: `agent/src/agent/config.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p agent/src/agent/core
mkdir -p agent/src/agent/llm
mkdir -p agent/src/agent/emitter
mkdir -p agent/src/agent/pipeline
mkdir -p agent/src/agent/repository
mkdir -p agent/tests
```

- [ ] **Step 2: Create pyproject.toml**

Create `agent/pyproject.toml`:

```toml
[project]
name = "trustworthy-agent"
version = "0.1.0"
description = "Trustworthy conversational agent with step-level traceability"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115",
    "uvicorn>=0.30",
    "httpx>=0.27",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "motor>=3.6",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "ruff>=0.8",
    "mypy>=1.13",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.backends"

[tool.hatch.build.targets.wheel]
packages = ["src/agent"]

[tool.ruff]
target-version = "py313"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.13"
strict = true
warn_return_any = true
warn_unused_configs = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["src"]
```

- [ ] **Step 3: Create .python-version**

Create `agent/.python-version`:

```
3.13
```

- [ ] **Step 4: Create package init**

Create `agent/src/agent/__init__.py`:

```python
"""Trustworthy conversational agent with step-level traceability."""
```

- [ ] **Step 5: Create config module**

Create `agent/src/agent/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Agent server configuration."""

    # Server
    host: str = "0.0.0.0"
    port: int = 8081

    # LLM Server (llm-serving vllm-mlx)
    llm_base_url: str = "http://localhost:8000"
    llm_model: str = "mlx-community/gemma-4-26B-A4B-it-4bit"
    llm_temperature: float = 0.0
    llm_timeout_seconds: int = 60

    # Eval Server (trace push destination)
    eval_base_url: str = "http://localhost:8090"
    eval_enabled: bool = True

    # MongoDB
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "agent_db"

    # Trace emitter type: "http" | "file" | "noop"
    trace_emitter: str = "http"
    trace_file_path: str = "./traces"

    model_config = {"env_prefix": "AGENT_"}
```

- [ ] **Step 6: [USER] Initialize uv environment**

```bash
cd agent && uv sync
```

- [ ] **Step 7: Commit**

```bash
git add agent/
git commit -m "feat(agent): scaffold project with uv, FastAPI, config

Python 3.13+, uv package manager, FastAPI + Pydantic v2.
Settings loaded from AGENT_ prefixed environment variables."
```

---

## Task 3: Agent Core Types — StepTrace

**Files:**
- Create: `agent/src/agent/core/__init__.py`
- Create: `agent/src/agent/core/trace.py`
- Create: `agent/tests/test_trace.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_trace.py`:

```python
from datetime import datetime, timezone

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
        started_at=datetime.now(timezone.utc),
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
        started_at=datetime.now(timezone.utc),
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
        started_at=datetime.now(timezone.utc),
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
        started_at=datetime.now(timezone.utc),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_trace.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent.core.trace'`

- [ ] **Step 3: Create core __init__.py**

Create `agent/src/agent/core/__init__.py`:

```python
"""Core types for trustworthy agent traceability."""
```

- [ ] **Step 4: Write StepTrace implementation**

Create `agent/src/agent/core/trace.py`:

```python
"""StepTrace and related types for step-level traceability.

Every execution step of the agent must produce a StepTrace.
This is Principle 4: Every step must be independently evaluable.

Reference: research/principles/trustworthy-agent-design.md
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
    """

    confidence_delta: float = Field(description="Change vs previous step")
    trend: str = Field(description="increasing | stable | dropping")


class StabilitySignal(BaseModel):
    """Intra-step stability — micro-level distribution characteristics.

    Maps to HTC "Intra-Step Stability" feature family.
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
    """

    def __init__(self) -> None:
        self.trace_id: str = str(uuid.uuid4())
        self._step_counter: int = 0

    def next_step_id(self) -> int:
        current = self._step_counter
        self._step_counter += 1
        return current
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_trace.py -v`
Expected: All 7 tests PASS

- [ ] **Step 6: Commit**

```bash
git add agent/src/agent/core/ agent/tests/test_trace.py
git commit -m "feat(agent): add StepTrace core types with tests

StepTrace, StepType, StepError, DynamicsSignal, StabilitySignal,
AnomalySignal, TraceContext — implements Principle 4.
HTC feature families mapped to signal types."
```

---

## Task 4: Agent Core Types — AgentResponse & Confidence

**Files:**
- Create: `agent/src/agent/core/confidence.py`
- Create: `agent/tests/test_confidence.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_confidence.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_confidence.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'agent.core.confidence'`

- [ ] **Step 3: Write confidence implementation**

Create `agent/src/agent/core/confidence.py`:

```python
"""3-tier confidence judgment.

Principle 5: When uncertain, stop and explain — never guess.
HTC qualitative finding: last step confidence 0.973 but answer was wrong.
Full trajectory confidence should have been 0.052.

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
    """Structured explanation when the agent cannot answer confidently."""

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
    hedges with a warning, or stops and explains.
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
        return f"Partial information gathered from {len(outputs)} step(s), but confidence is insufficient."
    return "No reliable information could be extracted."
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_confidence.py -v`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add agent/src/agent/core/confidence.py agent/tests/test_confidence.py
git commit -m "feat(agent): add 3-tier confidence judgment

AgentResponse with confident/hedged/uncertain status.
Implements Principle 5: when uncertain, stop and explain."
```

---

## Task 5: Agent Core Types — WorkflowContext

**Files:**
- Create: `agent/src/agent/core/context.py`
- Create: `agent/tests/test_context.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_context.py`:

```python
from agent.core.context import Fact, WorkflowContext


def test_workflow_context_slot_separation() -> None:
    """Verify that context slots are independent and don't leak."""
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="What is the weather?",
    )
    assert ctx.system_prompt == "You are a helpful assistant."
    assert ctx.current_input == "What is the weather?"
    assert ctx.session_facts == []
    assert ctx.history_summary == ""
    assert ctx.current_step_idx == 0


def test_workflow_context_with_facts() -> None:
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="Tell me more.",
        session_facts=[
            Fact(key="user_name", value="Hyungrok", verified=True),
        ],
        history_summary="User asked about weather. Agent responded with forecast.",
        current_step_idx=1,
    )
    assert len(ctx.session_facts) == 1
    assert ctx.session_facts[0].verified is True
    assert ctx.current_step_idx == 1


def test_workflow_context_builds_messages() -> None:
    """Context should produce a clean message list for LLM call."""
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="Hello!",
        history_summary="Previous conversation about greetings.",
    )
    messages = ctx.to_messages()
    assert messages[0]["role"] == "system"
    assert "helpful assistant" in messages[0]["content"]
    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == "Hello!"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_context.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write WorkflowContext implementation**

Create `agent/src/agent/core/context.py`:

```python
"""WorkflowContext with explicit slot separation.

Principle 2: Context boundaries must be explicitly designed.
Never implicitly mix results from previous steps with current input.

Slots:
    - Fixed zone: system_prompt (never modified)
    - Session zone: session_facts (verified facts only)
    - Current turn zone: current_input, current_step_idx (replaced every step)
    - History zone: history_summary (compressed, original removed)
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class Fact(BaseModel):
    """A verified fact from the session. Only verified facts enter the session zone."""

    key: str
    value: str
    verified: bool = False


class WorkflowContext(BaseModel):
    """Explicitly separated context slots for LLM calls.

    FORBIDDEN: merging multiple slots into a single string.
    Each zone has a clear lifecycle and update policy.
    """

    # Fixed zone — set once, never modified during conversation
    system_prompt: str
    workflow_def: dict[str, Any] = {}

    # Session zone — only verified facts
    session_facts: list[Fact] = []

    # Current turn zone — replaced every step
    current_input: str
    current_step_idx: int = 0

    # History zone — compressed summary only, originals discarded
    history_summary: str = ""

    def to_messages(self) -> list[dict[str, str]]:
        """Build LLM message list with clear slot boundaries.

        System message includes fixed zone + session context.
        User message is strictly the current input.
        History is injected as system context, not as fake user/assistant turns.
        """
        system_parts: list[str] = [self.system_prompt]

        if self.session_facts:
            verified = [f for f in self.session_facts if f.verified]
            if verified:
                facts_text = "\n".join(f"- {f.key}: {f.value}" for f in verified)
                system_parts.append(f"\n[Session Facts]\n{facts_text}")

        if self.history_summary:
            system_parts.append(f"\n[Conversation History]\n{self.history_summary}")

        return [
            {"role": "system", "content": "\n".join(system_parts)},
            {"role": "user", "content": self.current_input},
        ]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_context.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add agent/src/agent/core/context.py agent/tests/test_context.py
git commit -m "feat(agent): add WorkflowContext with slot separation

Explicit fixed/session/current/history zones.
Implements Principle 2: context boundaries must be explicitly designed."
```

---

## Task 6: Agent LLM Client

**Files:**
- Create: `agent/src/agent/llm/__init__.py`
- Create: `agent/src/agent/llm/client.py`
- Create: `agent/tests/test_llm_client.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_llm_client.py`:

```python
import httpx
import pytest

from agent.llm.client import LLMClient, LLMResponse


@pytest.fixture
def llm_client() -> LLMClient:
    return LLMClient(
        base_url="http://localhost:8000",
        model="test-model",
        temperature=0.0,
        timeout_seconds=10,
    )


def test_llm_client_builds_request_body(llm_client: LLMClient) -> None:
    """Verify request body includes logprobs parameter."""
    messages = [
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "Hello"},
    ]
    body = llm_client._build_request_body(messages)
    assert body["model"] == "test-model"
    assert body["temperature"] == 0.0
    assert body["logprobs"] is True
    assert body["top_logprobs"] == 5
    assert body["messages"] == messages


def test_llm_response_model() -> None:
    """Verify LLMResponse holds all required fields."""
    resp = LLMResponse(
        text="Hello there!",
        logprobs=[[-0.1, -0.3], [-0.2]],
        prompt_tokens=10,
        completion_tokens=5,
        finish_reason="stop",
    )
    assert resp.text == "Hello there!"
    assert resp.logprobs is not None
    assert resp.prompt_tokens == 10


def test_llm_response_without_logprobs() -> None:
    """LLMResponse should work without logprobs."""
    resp = LLMResponse(
        text="Hi!",
        logprobs=None,
        prompt_tokens=5,
        completion_tokens=2,
        finish_reason="stop",
    )
    assert resp.logprobs is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_llm_client.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write LLM client implementation**

Create `agent/src/agent/llm/__init__.py`:

```python
"""LLM client for communicating with llm-serving (vllm-mlx)."""
```

Create `agent/src/agent/llm/client.py`:

```python
"""OpenAI-compatible LLM client with logprobs support.

Calls llm-serving's vllm-mlx endpoint at /v1/chat/completions.
Collects token-level log-probabilities for HTC feature extraction.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class LLMResponse:
    """Parsed response from the LLM server."""

    text: str
    logprobs: list[list[float]] | None
    prompt_tokens: int
    completion_tokens: int
    finish_reason: str


class LLMClient:
    """Async HTTP client for OpenAI-compatible LLM API.

    Designed for llm-serving's vllm-mlx endpoint.
    Always requests logprobs for HTC analysis.
    """

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        temperature: float = 0.0,
        timeout_seconds: int = 60,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._temperature = temperature
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(timeout_seconds),
        )

    def _build_request_body(
        self, messages: list[dict[str, str]]
    ) -> dict[str, Any]:
        return {
            "model": self._model,
            "messages": messages,
            "temperature": self._temperature,
            "logprobs": True,
            "top_logprobs": 5,
        }

    async def chat(
        self, messages: list[dict[str, str]]
    ) -> LLMResponse:
        """Send chat completion request and parse response with logprobs."""
        body = self._build_request_body(messages)

        response = await self._client.post(
            "/v1/chat/completions",
            json=body,
        )
        response.raise_for_status()
        data = response.json()

        choice = data["choices"][0]
        text = choice["message"]["content"]
        finish_reason = choice.get("finish_reason", "stop")

        # Extract logprobs if available
        logprobs = self._extract_logprobs(choice)

        usage = data.get("usage", {})

        return LLMResponse(
            text=text,
            logprobs=logprobs,
            prompt_tokens=usage.get("prompt_tokens", 0),
            completion_tokens=usage.get("completion_tokens", 0),
            finish_reason=finish_reason,
        )

    def _extract_logprobs(
        self, choice: dict[str, Any]
    ) -> list[list[float]] | None:
        """Extract token-level log-probabilities from response.

        Returns a list of lists: outer = tokens, inner = top-k logprobs.
        """
        raw = choice.get("logprobs")
        if raw is None:
            return None

        content_tokens = raw.get("content")
        if content_tokens is None:
            return None

        result: list[list[float]] = []
        for token_info in content_tokens:
            top_logprobs = token_info.get("top_logprobs", [])
            result.append([lp.get("logprob", 0.0) for lp in top_logprobs])

        return result if result else None

    async def close(self) -> None:
        await self._client.aclose()
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_llm_client.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add agent/src/agent/llm/ agent/tests/test_llm_client.py
git commit -m "feat(agent): add LLM client with logprobs support

OpenAI-compatible async client for llm-serving vllm-mlx.
Requests logprobs on every call for HTC feature extraction."
```

---

## Task 7: Agent TraceEmitter

**Files:**
- Create: `agent/src/agent/emitter/__init__.py`
- Create: `agent/src/agent/emitter/protocol.py`
- Create: `agent/src/agent/emitter/http.py`
- Create: `agent/src/agent/emitter/file.py`
- Create: `agent/tests/test_emitter.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_emitter.py`:

```python
import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from agent.core.trace import (
    DynamicsSignal,
    StabilitySignal,
    StepTrace,
    StepType,
)
from agent.emitter.file import FileTraceEmitter


def _make_trace() -> StepTrace:
    return StepTrace(
        trace_id="emit-test-001",
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
        started_at=datetime.now(timezone.utc),
        duration_ms=100.0,
    )


@pytest.mark.asyncio
async def test_file_emitter_writes_trace(tmp_path: Path) -> None:
    emitter = FileTraceEmitter(output_dir=tmp_path)
    step = _make_trace()

    await emitter.emit(step)
    await emitter.flush("emit-test-001")

    files = list(tmp_path.glob("emit-test-001/*.jsonl"))
    assert len(files) == 1

    with open(files[0]) as f:
        lines = f.readlines()
    assert len(lines) == 1

    data = json.loads(lines[0])
    assert data["trace_id"] == "emit-test-001"
    assert data["step_type"] == "llm_call"


@pytest.mark.asyncio
async def test_file_emitter_multiple_steps(tmp_path: Path) -> None:
    emitter = FileTraceEmitter(output_dir=tmp_path)

    step1 = _make_trace()
    step2 = _make_trace()
    step2.step_id = 1
    step2.is_first = False

    await emitter.emit(step1)
    await emitter.emit(step2)
    await emitter.flush("emit-test-001")

    files = list(tmp_path.glob("emit-test-001/*.jsonl"))
    with open(files[0]) as f:
        lines = f.readlines()
    assert len(lines) == 2
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_emitter.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write emitter implementations**

Create `agent/src/agent/emitter/__init__.py`:

```python
"""Trace emitters — push StepTrace data to external systems."""
```

Create `agent/src/agent/emitter/protocol.py`:

```python
"""TraceEmitter protocol — OpenTelemetry-inspired abstraction.

The agent doesn't know WHERE traces go. It only knows the protocol.
Implementations are swapped via configuration:
    - HttpTraceEmitter: push to eval server (production)
    - FileTraceEmitter: write to local JSON (development)
    - NoopTraceEmitter: discard (eval server unavailable)
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from agent.core.trace import StepTrace


@runtime_checkable
class TraceEmitter(Protocol):
    async def emit(self, step: StepTrace) -> None:
        """Emit a single step trace."""
        ...

    async def flush(self, trace_id: str) -> None:
        """Signal that a trace is complete. Triggers downstream processing."""
        ...


class NoopTraceEmitter:
    """Emitter that discards all traces. Used when eval is disabled."""

    async def emit(self, step: StepTrace) -> None:
        pass

    async def flush(self, trace_id: str) -> None:
        pass
```

Create `agent/src/agent/emitter/http.py`:

```python
"""HTTP trace emitter — pushes StepTrace to the eval server."""

from __future__ import annotations

import logging

import httpx

from agent.core.trace import StepTrace

logger = logging.getLogger(__name__)


class HttpTraceEmitter:
    """Push traces to eval server via HTTP POST.

    Mirrors the OpenTelemetry collector pattern:
    agent instruments itself → pushes spans to collector.
    """

    def __init__(self, *, eval_base_url: str) -> None:
        self._base_url = eval_base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            timeout=httpx.Timeout(10.0),
        )

    async def emit(self, step: StepTrace) -> None:
        """Push a single step to the eval server."""
        try:
            response = await self._client.post(
                "/api/traces",
                json=step.model_dump(mode="json"),
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Failed to emit trace step: %s", e)

    async def flush(self, trace_id: str) -> None:
        """Signal trace completion to eval server."""
        try:
            response = await self._client.post(
                f"/api/traces/{trace_id}/flush",
            )
            response.raise_for_status()
        except httpx.HTTPError as e:
            logger.warning("Failed to flush trace: %s", e)

    async def close(self) -> None:
        await self._client.aclose()
```

Create `agent/src/agent/emitter/file.py`:

```python
"""File trace emitter — writes StepTrace to local JSONL files.

Used for development and debugging. Each trace_id gets its own directory.
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from agent.core.trace import StepTrace


class FileTraceEmitter:
    """Write traces to local JSONL files for development inspection."""

    def __init__(self, *, output_dir: Path) -> None:
        self._output_dir = output_dir
        self._buffers: dict[str, list[dict]] = defaultdict(list)  # type: ignore[type-arg]

    async def emit(self, step: StepTrace) -> None:
        self._buffers[step.trace_id].append(step.model_dump(mode="json"))

    async def flush(self, trace_id: str) -> None:
        """Write buffered steps to a JSONL file."""
        steps = self._buffers.pop(trace_id, [])
        if not steps:
            return

        trace_dir = self._output_dir / trace_id
        trace_dir.mkdir(parents=True, exist_ok=True)

        filepath = trace_dir / "steps.jsonl"
        with open(filepath, "w") as f:
            for step_data in steps:
                f.write(json.dumps(step_data, ensure_ascii=False) + "\n")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_emitter.py -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Verify NoopTraceEmitter satisfies Protocol**

Create quick inline test in `agent/tests/test_emitter.py` — append:

```python
from agent.emitter.protocol import NoopTraceEmitter, TraceEmitter
from agent.emitter.http import HttpTraceEmitter


def test_noop_satisfies_protocol() -> None:
    assert isinstance(NoopTraceEmitter(), TraceEmitter)


def test_file_satisfies_protocol(tmp_path: Path) -> None:
    assert isinstance(FileTraceEmitter(output_dir=tmp_path), TraceEmitter)
```

Run: `cd agent && uv run pytest tests/test_emitter.py -v`
Expected: All 4 tests PASS

- [ ] **Step 6: Commit**

```bash
git add agent/src/agent/emitter/ agent/tests/test_emitter.py
git commit -m "feat(agent): add TraceEmitter protocol + implementations

Protocol (OpenTelemetry pattern), HttpTraceEmitter (eval push),
FileTraceEmitter (local dev), NoopTraceEmitter (disabled).
Agent doesn't know where traces go — only the protocol."
```

---

## Task 8: Agent Conversation Pipeline

**Files:**
- Create: `agent/src/agent/pipeline/__init__.py`
- Create: `agent/src/agent/pipeline/conversation.py`
- Create: `agent/tests/test_pipeline.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_pipeline.py`:

```python
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest

from agent.core.confidence import AgentResponse
from agent.core.context import WorkflowContext
from agent.core.trace import StepTrace, StepType
from agent.emitter.protocol import NoopTraceEmitter
from agent.llm.client import LLMResponse
from agent.pipeline.conversation import ConversationPipeline


@pytest.fixture
def mock_llm_client() -> AsyncMock:
    client = AsyncMock()
    client.chat.return_value = LLMResponse(
        text="Hello! How can I help you?",
        logprobs=[[-0.1, -0.3], [-0.05, -0.2], [-0.1]],
        prompt_tokens=20,
        completion_tokens=8,
        finish_reason="stop",
    )
    return client


@pytest.fixture
def pipeline(mock_llm_client: AsyncMock) -> ConversationPipeline:
    return ConversationPipeline(
        llm_client=mock_llm_client,
        emitter=NoopTraceEmitter(),
        system_prompt="You are a helpful assistant.",
    )


@pytest.mark.asyncio
async def test_pipeline_returns_agent_response(
    pipeline: ConversationPipeline,
) -> None:
    response = await pipeline.run(user_input="Hello!")
    assert isinstance(response, AgentResponse)
    assert response.answer is not None
    assert response.trace_id != ""
    assert len(response.steps) >= 1


@pytest.mark.asyncio
async def test_pipeline_creates_step_trace(
    pipeline: ConversationPipeline,
    mock_llm_client: AsyncMock,
) -> None:
    response = await pipeline.run(user_input="Hello!")
    step = response.steps[0]

    assert step.step_type == StepType.LLM_CALL
    assert step.is_first is True
    assert step.is_last is True
    assert step.input["prompt"] == "Hello!"
    assert "Hello! How can I help you?" in step.output["response"]
    assert step.logprobs is not None
    assert step.duration_ms > 0


@pytest.mark.asyncio
async def test_pipeline_emits_trace(
    mock_llm_client: AsyncMock,
) -> None:
    mock_emitter = AsyncMock()
    pipeline = ConversationPipeline(
        llm_client=mock_llm_client,
        emitter=mock_emitter,
        system_prompt="You are a helpful assistant.",
    )
    await pipeline.run(user_input="Hello!")

    mock_emitter.emit.assert_called_once()
    mock_emitter.flush.assert_called_once()

    emitted_step = mock_emitter.emit.call_args[0][0]
    assert isinstance(emitted_step, StepTrace)


@pytest.mark.asyncio
async def test_pipeline_handles_llm_failure(
    mock_llm_client: AsyncMock,
) -> None:
    mock_llm_client.chat.side_effect = Exception("connection timeout")
    pipeline = ConversationPipeline(
        llm_client=mock_llm_client,
        emitter=NoopTraceEmitter(),
        system_prompt="You are a helpful assistant.",
    )

    response = await pipeline.run(user_input="Hello!")

    assert response.status == "uncertain"
    assert response.uncertainty is not None
    assert len(response.steps) == 1
    assert response.steps[0].error is not None
    assert response.steps[0].error.failure_category == "reasoning"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_pipeline.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write conversation pipeline**

Create `agent/src/agent/pipeline/__init__.py`:

```python
"""Agent execution pipelines."""
```

Create `agent/src/agent/pipeline/conversation.py`:

```python
"""Minimal conversation pipeline — Phase 1 Augmented LLM.

Single LLM call wrapped with StepTrace. Every call is traced.
This is the simplest possible pipeline that satisfies Principle 4.

Flow:
    User input → WorkflowContext → LLM call → StepTrace → Confidence → Response
"""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from agent.core.confidence import AgentResponse, judge_confidence
from agent.core.context import WorkflowContext
from agent.core.trace import (
    DynamicsSignal,
    StabilitySignal,
    StepError,
    StepTrace,
    StepType,
    TraceContext,
)
from agent.emitter.protocol import TraceEmitter
from agent.llm.client import LLMClient

logger = logging.getLogger(__name__)


class ConversationPipeline:
    """Phase 1: Augmented LLM — single LLM call with full traceability."""

    def __init__(
        self,
        *,
        llm_client: LLMClient,
        emitter: TraceEmitter,
        system_prompt: str,
    ) -> None:
        self._llm = llm_client
        self._emitter = emitter
        self._system_prompt = system_prompt

    async def run(
        self,
        *,
        user_input: str,
        history_summary: str = "",
    ) -> AgentResponse:
        """Execute the conversation pipeline with full tracing."""
        trace_ctx = TraceContext()

        # Build context with explicit slot separation (Principle 2)
        workflow_ctx = WorkflowContext(
            system_prompt=self._system_prompt,
            current_input=user_input,
            history_summary=history_summary,
        )

        # Single LLM call wrapped with StepTrace (Principle 4)
        step = await self._call_llm(trace_ctx, workflow_ctx)

        # Emit trace to eval server (OpenTelemetry pattern)
        await self._emitter.emit(step)
        await self._emitter.flush(trace_ctx.trace_id)

        # Confidence judgment (Principle 5)
        if step.error is not None:
            return judge_confidence(
                trace_id=trace_ctx.trace_id,
                answer="",
                steps=[step],
                final_confidence=0.0,
            )

        return judge_confidence(
            trace_id=trace_ctx.trace_id,
            answer=step.output.get("response", ""),
            steps=[step],
            final_confidence=step.confidence,
        )

    async def _call_llm(
        self,
        trace_ctx: TraceContext,
        workflow_ctx: WorkflowContext,
    ) -> StepTrace:
        """Make an LLM call and record it as a StepTrace.

        FORBIDDEN: calling LLM without creating a StepTrace.
        """
        step_id = trace_ctx.next_step_id()
        started_at = datetime.now(timezone.utc)
        start_time = time.monotonic()

        messages = workflow_ctx.to_messages()

        try:
            llm_response = await self._llm.chat(messages)
            duration_ms = (time.monotonic() - start_time) * 1000

            confidence = self._estimate_confidence(llm_response.logprobs)

            return StepTrace(
                trace_id=trace_ctx.trace_id,
                step_id=step_id,
                step_type=StepType.LLM_CALL,
                is_first=True,
                is_last=True,
                input={"prompt": workflow_ctx.current_input},
                output={"response": llm_response.text},
                confidence=confidence,
                reasoning=f"LLM response with {llm_response.completion_tokens} tokens",
                dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
                stability=StabilitySignal(
                    output_consistency=1.0,
                ),
                logprobs=llm_response.logprobs,
                started_at=started_at,
                duration_ms=duration_ms,
            )

        except Exception as e:
            duration_ms = (time.monotonic() - start_time) * 1000
            logger.error("LLM call failed: %s", e)

            return StepTrace(
                trace_id=trace_ctx.trace_id,
                step_id=step_id,
                step_type=StepType.LLM_CALL,
                is_first=True,
                is_last=True,
                input={"prompt": workflow_ctx.current_input},
                output={},
                confidence=0.0,
                reasoning=f"LLM call failed: {e}",
                dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
                stability=StabilitySignal(output_consistency=0.0),
                error=StepError(
                    code="llm_failure",
                    message=str(e),
                    failure_category="reasoning",
                ),
                started_at=started_at,
                duration_ms=duration_ms,
            )

    def _estimate_confidence(
        self, logprobs: list[list[float]] | None
    ) -> float:
        """Estimate confidence from token log-probabilities.

        Phase 1: simple average of top-1 logprobs converted to probability.
        Phase 2+: will be replaced by HTC calibrator in eval server.
        """
        if not logprobs:
            return 0.7  # default when logprobs unavailable

        import math

        top1_probs = [math.exp(token_lps[0]) for token_lps in logprobs if token_lps]
        if not top1_probs:
            return 0.7

        return sum(top1_probs) / len(top1_probs)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_pipeline.py -v`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add agent/src/agent/pipeline/ agent/tests/test_pipeline.py
git commit -m "feat(agent): add conversation pipeline with StepTrace

Augmented LLM pattern — single LLM call, full traceability.
Every LLM call produces StepTrace. Failures are structured as StepError.
Confidence estimated from logprobs (Phase 1 simple average)."
```

---

## Task 9: Agent FastAPI Application

**Files:**
- Create: `agent/src/agent/main.py`
- Create: `agent/tests/test_main.py`

- [ ] **Step 1: Write the failing test**

Create `agent/tests/test_main.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from agent.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "agent"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd agent && uv run pytest tests/test_main.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write FastAPI application**

Create `agent/src/agent/main.py`:

```python
"""FastAPI application for the trustworthy agent server.

Endpoints:
    POST /api/chat         — Process user message through conversation pipeline
    GET  /api/health       — Health check
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI
from pydantic import BaseModel

from agent.config import Settings
from agent.emitter.file import FileTraceEmitter
from agent.emitter.http import HttpTraceEmitter
from agent.emitter.protocol import NoopTraceEmitter, TraceEmitter
from agent.llm.client import LLMClient
from agent.pipeline.conversation import ConversationPipeline

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


def _build_emitter(settings: Settings) -> TraceEmitter:
    match settings.trace_emitter:
        case "http":
            return HttpTraceEmitter(eval_base_url=settings.eval_base_url)
        case "file":
            return FileTraceEmitter(output_dir=Path(settings.trace_file_path))
        case _:
            return NoopTraceEmitter()


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory with dependency injection."""
    if settings is None:
        settings = Settings()

    state: dict[str, Any] = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Startup
        llm_client = LLMClient(
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            timeout_seconds=settings.llm_timeout_seconds,
        )
        emitter = _build_emitter(settings)
        pipeline = ConversationPipeline(
            llm_client=llm_client,
            emitter=emitter,
            system_prompt="You are a helpful, trustworthy assistant. When you are uncertain, say so clearly.",
        )

        state["pipeline"] = pipeline
        state["llm_client"] = llm_client
        state["emitter"] = emitter

        logger.info(
            "Agent server started (llm=%s, emitter=%s)",
            settings.llm_model,
            settings.trace_emitter,
        )
        yield

        # Shutdown
        await llm_client.close()
        if hasattr(emitter, "close"):
            await emitter.close()

    app = FastAPI(
        title="Trustworthy Agent",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "agent"}

    @app.post("/api/chat")
    async def chat(request: ChatRequest) -> dict[str, Any]:
        pipeline: ConversationPipeline = state["pipeline"]
        response = await pipeline.run(user_input=request.message)
        return response.model_dump(mode="json")

    return app
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd agent && uv run pytest tests/test_main.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add agent/src/agent/main.py agent/tests/test_main.py
git commit -m "feat(agent): add FastAPI application with /api/chat and /api/health

Application factory pattern with lifespan for clean startup/shutdown.
POST /api/chat processes messages through conversation pipeline.
Emitter type selected from AGENT_TRACE_EMITTER env var."
```

---

## Task 10: Eval Server Scaffold + Core Models

**Files:**
- Create: `eval/pyproject.toml`
- Create: `eval/.python-version`
- Create: `eval/src/eval/__init__.py`
- Create: `eval/src/eval/config.py`
- Create: `eval/src/eval/core/__init__.py`
- Create: `eval/src/eval/core/models.py`
- Create: `eval/tests/test_models.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p eval/src/eval/core
mkdir -p eval/src/eval/collector
mkdir -p eval/src/eval/reporter
mkdir -p eval/src/eval/repository
mkdir -p eval/tests
```

- [ ] **Step 2: Create pyproject.toml**

Create `eval/pyproject.toml`:

```toml
[project]
name = "trustworthy-eval"
version = "0.1.0"
description = "Agent evaluation system with HTC-based confidence calibration"
requires-python = ">=3.13"
dependencies = [
    "fastapi>=0.115",
    "uvicorn>=0.30",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "motor>=3.6",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.24",
    "ruff>=0.8",
    "mypy>=1.13",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.backends"

[tool.hatch.build.targets.wheel]
packages = ["src/eval"]

[tool.ruff]
target-version = "py313"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.mypy]
python_version = "3.13"
strict = true
warn_return_any = true
warn_unused_configs = true

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["src"]
```

- [ ] **Step 3: Create config and package files**

Create `eval/.python-version`:

```
3.13
```

Create `eval/src/eval/__init__.py`:

```python
"""Agent evaluation system with HTC-based confidence calibration."""
```

Create `eval/src/eval/config.py`:

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Eval server configuration."""

    host: str = "0.0.0.0"
    port: int = 8090

    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_database: str = "eval_db"

    model_config = {"env_prefix": "EVAL_"}
```

Create `eval/src/eval/core/__init__.py`:

```python
"""Core evaluation models and metrics."""
```

- [ ] **Step 4: Write the failing test**

Create `eval/tests/test_models.py`:

```python
from datetime import datetime, timezone

from eval.core.models import (
    DynamicsSignal,
    StabilitySignal,
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
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd eval && uv sync && uv run pytest tests/test_models.py -v`
(`uv sync` is [USER] step)
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 6: Write eval core models**

Create `eval/src/eval/core/models.py`:

```python
"""Received StepTrace models — mirrors agent's types for the HTTP contract.

These are independent from agent's types to avoid coupling.
The interface is the JSON schema, not a shared Python package.
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd eval && uv run pytest tests/test_models.py -v`
Expected: All 3 tests PASS

- [ ] **Step 8: Commit**

```bash
git add eval/
git commit -m "feat(eval): scaffold eval server with core models

Python 3.13+, FastAPI, Pydantic v2.
StepTraceReceived mirrors agent's StepTrace for JSON contract."
```

---

## Task 11: Eval Collector + Basic Metrics

**Files:**
- Create: `eval/src/eval/collector/__init__.py`
- Create: `eval/src/eval/collector/receiver.py`
- Create: `eval/src/eval/core/metrics.py`
- Create: `eval/src/eval/reporter/__init__.py`
- Create: `eval/src/eval/reporter/console.py`
- Create: `eval/tests/test_collector.py`
- Create: `eval/tests/test_metrics.py`

- [ ] **Step 1: Write the failing tests**

Create `eval/tests/test_metrics.py`:

```python
from eval.core.metrics import compute_step_metrics, StepMetrics
from eval.core.models import DynamicsSignal, StabilitySignal, StepTraceReceived
from datetime import datetime, timezone


def _make_trace(
    confidence: float = 0.85,
    duration_ms: float = 100.0,
    has_error: bool = False,
) -> StepTraceReceived:
    from eval.core.models import StepError

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
        started_at=datetime.now(timezone.utc),
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval && uv run pytest tests/test_metrics.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write metrics implementation**

Create `eval/src/eval/core/metrics.py`:

```python
"""Step-level metrics computation.

Phase 1: basic metrics (success/fail, confidence level, duration).
Phase 2+: HTC 48-dim feature extraction, calibration.
"""

from __future__ import annotations

from dataclasses import dataclass

from eval.core.models import StepTraceReceived

CONFIDENCE_THRESHOLD_CERTAIN: float = 0.80
CONFIDENCE_THRESHOLD_HEDGED: float = 0.50


@dataclass(frozen=True)
class StepMetrics:
    """Computed metrics for a single step."""

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
```

- [ ] **Step 4: Run metrics tests**

Run: `cd eval && uv run pytest tests/test_metrics.py -v`
Expected: All 3 tests PASS

- [ ] **Step 5: Write collector and console reporter**

Create `eval/src/eval/collector/__init__.py`:

```python
"""Trace collection from agent server."""
```

Create `eval/src/eval/collector/receiver.py`:

```python
"""Trace receiver — collects StepTrace data pushed by the agent.

Buffers steps per trace_id, then processes on flush.
"""

from __future__ import annotations

import logging
from collections import defaultdict

from eval.core.metrics import StepMetrics, compute_step_metrics
from eval.core.models import StepTraceReceived
from eval.reporter.console import ConsoleReporter

logger = logging.getLogger(__name__)


class TraceReceiver:
    """Receives and buffers traces, computes metrics on flush."""

    def __init__(self) -> None:
        self._buffers: dict[str, list[StepTraceReceived]] = defaultdict(list)
        self._reporter = ConsoleReporter()

    def receive(self, step: StepTraceReceived) -> None:
        """Buffer a received step trace."""
        self._buffers[step.trace_id].append(step)
        logger.info(
            "Received step: trace_id=%s step_id=%d type=%s confidence=%.2f",
            step.trace_id,
            step.step_id,
            step.step_type,
            step.confidence,
        )

    def flush(self, trace_id: str) -> list[StepMetrics]:
        """Process all buffered steps for a trace and compute metrics."""
        steps = self._buffers.pop(trace_id, [])
        if not steps:
            logger.warning("Flush called for unknown trace: %s", trace_id)
            return []

        steps.sort(key=lambda s: s.step_id)
        metrics = [compute_step_metrics(step) for step in steps]
        self._reporter.report(trace_id, metrics)
        return metrics
```

Create `eval/src/eval/reporter/__init__.py`:

```python
"""Report generators for evaluation results."""
```

Create `eval/src/eval/reporter/console.py`:

```python
"""Console reporter — prints step-level metrics to terminal."""

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
        logger.info("Steps: %d | Success: %d/%d | Avg Confidence: %.2f",
                     total, successes, total, avg_confidence)
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
```

- [ ] **Step 6: Write collector test**

Create `eval/tests/test_collector.py`:

```python
from datetime import datetime, timezone

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
        started_at=datetime.now(timezone.utc),
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
```

- [ ] **Step 7: Run all eval tests**

Run: `cd eval && uv run pytest tests/ -v`
Expected: All tests PASS (3 model + 3 metrics + 3 collector = 9 tests)

- [ ] **Step 8: Commit**

```bash
git add eval/src/eval/core/metrics.py eval/src/eval/collector/ eval/src/eval/reporter/ eval/tests/
git commit -m "feat(eval): add trace collector, step metrics, console reporter

TraceReceiver buffers steps and computes metrics on flush.
StepMetrics: success/fail, confidence level, duration.
ConsoleReporter outputs formatted results to terminal."
```

---

## Task 12: Eval FastAPI Application

**Files:**
- Create: `eval/src/eval/main.py`
- Create: `eval/tests/test_main.py`

- [ ] **Step 1: Write the failing test**

Create `eval/tests/test_main.py`:

```python
import pytest
from httpx import ASGITransport, AsyncClient

from eval.main import create_app


@pytest.fixture
def app():
    return create_app()


@pytest.fixture
async def client(app) -> AsyncClient:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "eval"


@pytest.mark.asyncio
async def test_receive_trace_and_flush(client: AsyncClient) -> None:
    # Send a step trace
    step_data = {
        "trace_id": "integration-001",
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
        "started_at": "2026-04-15T10:00:00Z",
        "duration_ms": 100.0,
    }
    response = await client.post("/api/traces", json=step_data)
    assert response.status_code == 200

    # Flush and get metrics
    response = await client.post("/api/traces/integration-001/flush")
    assert response.status_code == 200
    data = response.json()
    assert data["trace_id"] == "integration-001"
    assert len(data["metrics"]) == 1
    assert data["metrics"][0]["success"] is True
    assert data["metrics"][0]["confidence_level"] == "confident"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd eval && uv run pytest tests/test_main.py -v`
Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write eval FastAPI application**

Create `eval/src/eval/main.py`:

```python
"""FastAPI application for the evaluation server.

Endpoints:
    POST /api/traces                     — Receive StepTrace from agent
    POST /api/traces/{trace_id}/flush    — Trigger evaluation for a trace
    GET  /api/evaluations/{trace_id}     — Get evaluation results (Phase 2)
    GET  /api/health                     — Health check
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI

from eval.collector.receiver import TraceReceiver
from eval.config import Settings
from eval.core.models import StepTraceReceived

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory."""
    if settings is None:
        settings = Settings()

    receiver = TraceReceiver()

    app = FastAPI(
        title="Trustworthy Eval",
        version="0.1.0",
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "eval"}

    @app.post("/api/traces")
    async def receive_trace(step: StepTraceReceived) -> dict[str, str]:
        receiver.receive(step)
        return {"status": "received", "trace_id": step.trace_id}

    @app.post("/api/traces/{trace_id}/flush")
    async def flush_trace(trace_id: str) -> dict[str, Any]:
        metrics = receiver.flush(trace_id)
        return {
            "trace_id": trace_id,
            "metrics": [asdict(m) for m in metrics],
        }

    return app
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd eval && uv run pytest tests/test_main.py -v`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add eval/src/eval/main.py eval/tests/test_main.py
git commit -m "feat(eval): add FastAPI application with trace endpoints

POST /api/traces receives StepTrace from agent.
POST /api/traces/{trace_id}/flush triggers evaluation.
Returns step-level metrics on flush."
```

---

## Task 13: Docker Setup

**Files:**
- Create: `agent/Dockerfile`
- Create: `eval/Dockerfile`
- Create: `docker-compose.yml`

- [ ] **Step 1: Create Agent Dockerfile**

Create `agent/Dockerfile`:

```dockerfile
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cache layer)
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code
COPY src/ src/

# Install the project
RUN uv sync --frozen --no-dev

EXPOSE 8081

CMD ["uv", "run", "uvicorn", "agent.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8081"]
```

- [ ] **Step 2: Create Eval Dockerfile**

Create `eval/Dockerfile`:

```dockerfile
FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Install dependencies first (cache layer)
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

# Copy source code
COPY src/ src/

# Install the project
RUN uv sync --frozen --no-dev

EXPOSE 8090

CMD ["uv", "run", "uvicorn", "eval.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8090"]
```

- [ ] **Step 3: Create docker-compose.yml**

Create `docker-compose.yml` at project root:

```yaml
services:
  agent:
    build:
      context: ./agent
    ports:
      - "8081:8081"
    environment:
      - AGENT_LLM_BASE_URL=http://host.docker.internal:8000
      - AGENT_EVAL_BASE_URL=http://eval:8090
      - AGENT_TRACE_EMITTER=http
      - AGENT_MONGODB_URL=mongodb://mongodb:27017
      - AGENT_MONGODB_DATABASE=agent_db
    depends_on:
      - mongodb
      - eval
    restart: unless-stopped

  eval:
    build:
      context: ./eval
    ports:
      - "8090:8090"
    environment:
      - EVAL_MONGODB_URL=mongodb://mongodb:27017
      - EVAL_MONGODB_DATABASE=eval_db
    depends_on:
      - mongodb
    restart: unless-stopped

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

volumes:
  mongo-data:
```

- [ ] **Step 4: Verify Dockerfiles build (dry run)**

Run: `docker compose config`
Expected: Valid YAML output, no errors

- [ ] **Step 5: Commit**

```bash
git add agent/Dockerfile eval/Dockerfile docker-compose.yml
git commit -m "feat: add Docker setup for agent, eval, and MongoDB

docker-compose orchestrates all services.
Agent connects to LLM via host.docker.internal:8000.
MongoDB with persistent volume for stateful data."
```

---

## Task 14: Run Full Test Suite + Lint

- [ ] **Step 1: Run agent tests**

Run: `cd agent && uv run pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 2: Run eval tests**

Run: `cd eval && uv run pytest tests/ -v`
Expected: All tests PASS

- [ ] **Step 3: Run ruff lint on agent**

Run: `cd agent && uv run ruff check src/ tests/`
Expected: No errors

- [ ] **Step 4: Run ruff lint on eval**

Run: `cd eval && uv run ruff check src/ tests/`
Expected: No errors

- [ ] **Step 5: Fix any issues found**

Address lint errors or test failures.

- [ ] **Step 6: Final commit if any fixes**

```bash
git add -A
git commit -m "fix: resolve lint and test issues"
```

---

## Summary

| Task | Component | What It Delivers |
|------|-----------|-----------------|
| 1 | Project | research/ directory migration |
| 2 | Agent | Project scaffold (uv, config, directory structure) |
| 3 | Agent | StepTrace, TraceContext, signal types |
| 4 | Agent | AgentResponse, 3-tier confidence judgment |
| 5 | Agent | WorkflowContext with slot separation |
| 6 | Agent | LLM client with logprobs |
| 7 | Agent | TraceEmitter protocol + 3 implementations |
| 8 | Agent | Conversation pipeline (Augmented LLM) |
| 9 | Agent | FastAPI app (/api/chat, /api/health) |
| 10 | Eval | Project scaffold + core models |
| 11 | Eval | Trace collector, step metrics, console reporter |
| 12 | Eval | FastAPI app (/api/traces, /api/health) |
| 13 | Infra | Dockerfiles + docker-compose.yml |
| 14 | Quality | Full test suite + lint |

**Total: 14 tasks, ~40 steps, each 2-5 minutes**
