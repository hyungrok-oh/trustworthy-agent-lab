# CLAUDE.md

This file provides context for Claude Code to understand this project.
Read this before writing any code and apply the principles below to every implementation.

---

## Project Overview

**Purpose**: Trustworthy LLM agent — research testbed for traceable, confidence-calibrated agent architecture
**Language**: Python (FastAPI, Pydantic, Motor, httpx)
**LLM**: Gemma-4-26B-A4B-it-4bit (mlx-community, served via vllm-mlx)
**Current Phase**: Phase 1.5 complete — single LLM call with full traceability + MongoDB persistence
**Core goal**: Build an agent enterprise clients can trust — one that says "I don't know" when uncertain, and makes every failure traceable

**System Architecture:**
- Agent Server (:8081) — `agent/` — conversation pipeline, StepTrace emission
- Eval Server (:8090) — `eval/` — trace collection, metrics, MongoDB persistence
- LLM Server (:8000) — `llm-serving` (vllm-mlx, runs on host)
- MongoDB (:27017) — stateful, Docker volume

---

## Design Philosophy (Non-negotiable Principles)

### Principle 1. Every step must be independently traceable
- Evaluating only the final output makes it impossible to know where things went wrong
- Every step's input, output, and decision must be recorded in a structured format
- Never write code that calls LLM without a StepTrace

### Principle 2. When uncertain, stop and explain — never guess
- Do not proceed to the next step with low confidence
- Surface failures transparently, never hide them
- Response format: "I don't know + reason + possible alternative"

### Principle 3. Context boundaries must be explicitly designed
- Never implicitly mix results from previous steps with current input
- Context slots must be explicitly separated at the code level

### Principle 4. Prefer simple, traceable structures over complex abstractions
- Code that can't be debugged can't be trusted
- Minimize logic hidden behind interfaces

---

## Core Types (Must Follow)

### StepTrace — Required for every step

```python
# agent/src/agent/core/trace.py
class StepType(StrEnum):
    LLM_CALL = "llm_call"
    WORKFLOW = "workflow"
    DECISION = "decision"
    TOOL_CALL = "tool_call"

class StepError(BaseModel):
    code: str
    message: str
    failure_category: str  # planning | retrieval | reasoning | tool_use | context | output

class DynamicsSignal(BaseModel):
    confidence_delta: float   # Change vs previous step
    trend: str                # increasing | stable | dropping

class StabilitySignal(BaseModel):
    output_consistency: float  # 0.0 ~ 1.0

class AnomalySignal(BaseModel):
    type: str
    severity: str              # low | medium | high
    description: str

class StepTrace(BaseModel):
    trace_id: str
    step_id: int
    step_type: StepType
    is_first: bool
    is_last: bool

    input: dict[str, Any]
    output: dict[str, Any]
    error: StepError | None = None

    confidence: float          # 0.0 ~ 1.0
    reasoning: str

    dynamics: DynamicsSignal
    stability: StabilitySignal
    anomaly: AnomalySignal | None = None

    logprobs: list[list[float]] | None = None  # raw token logprobs for HTC
    started_at: datetime
    duration_ms: float

class TraceContext:
    """One per user request. Creates trace_id and auto-increments step_id."""
    def __init__(self) -> None:
        self.trace_id: str = str(uuid.uuid4())
        self._step_counter: int = 0

    def next_step_id(self) -> int: ...
```

### AgentResponse — Always include confidence

```python
# agent/src/agent/core/confidence.py
class ResponseStatus(StrEnum):
    CONFIDENT = "confident"
    HEDGED = "hedged"
    UNCERTAIN = "uncertain"

class UncertainInfo(BaseModel):
    reason: str
    what_i_know: str
    suggested_action: str

class AgentResponse(BaseModel):
    trace_id: str
    status: ResponseStatus
    answer: str = ""

    confidence: float
    caveat: str = ""
    uncertainty: UncertainInfo | None = None

    steps: list[StepTrace]  # full trace path
```

---

## Coding Rules

### LLM Calls — Always wrap with StepTrace

```python
# Correct pattern — agent/src/agent/pipeline/conversation.py
async def _call_llm(self, trace_ctx: TraceContext, workflow_ctx: WorkflowContext) -> StepTrace:
    step_id = trace_ctx.next_step_id()
    started_at = datetime.now(UTC)
    start_time = time.monotonic()

    try:
        llm_response = await self._llm.chat(workflow_ctx.to_messages())
        duration_ms = (time.monotonic() - start_time) * 1000

        return StepTrace(
            trace_id=trace_ctx.trace_id,
            step_id=step_id,
            step_type=StepType.LLM_CALL,
            is_first=True,
            is_last=True,
            input={"prompt": workflow_ctx.current_input},
            output={"response": llm_response.text},
            confidence=self._estimate_confidence(llm_response.logprobs),
            reasoning=f"LLM response with {llm_response.completion_tokens} tokens",
            dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
            stability=StabilitySignal(output_consistency=1.0),
            logprobs=llm_response.logprobs,
            started_at=started_at,
            duration_ms=duration_ms,
        )
    except Exception as e:
        ...  # always return StepTrace even on error — never let an exception escape without a trace

# Forbidden — never do this
llm_response = await self._llm.chat(messages)  # direct call without StepTrace
```

### LLM Response Post-processing — Strip Gemma reasoning channel

```python
# Gemma-4-26B includes <|channel>thought ... <channel|> reasoning tokens in responses.
# Strip from user-facing answer; preserve in StepTrace.output["response"] for traceability.
def strip_reasoning_channel(text: str) -> str:
    return re.sub(r"<\|channel>thought.*?<channel\|>", "", text, flags=re.DOTALL)

# In pipeline — strip AFTER recording the raw response in StepTrace:
answer = strip_reasoning_channel(step.output.get("response", ""))
# Never strip before StepTrace is built — raw must be preserved for eval
```

### Workflow Transitions — Always record reason

```python
def _transition(self, trace_ctx: TraceContext, from_state: str, to_state: str, reason: str) -> StepTrace:
    return StepTrace(
        trace_id=trace_ctx.trace_id,
        step_id=trace_ctx.next_step_id(),
        step_type=StepType.DECISION,
        input={"from_state": from_state},
        output={"to_state": to_state},
        reasoning=reason,  # always record why
        ...
    )
```

### Error Handling — Classify failure by category

```python
# Based on AgentHallu taxonomy
FAILURE_CATEGORIES = {
    "planning":   "Goal interpretation failure",
    "retrieval":  "Knowledge retrieval failure",
    "reasoning":  "Reasoning / inference error",
    "tool_use":   "Tool call failure",
    "context":    "Context contamination",
    "output":     "Output generation failure",
}

# Always use StepError, never raise bare exceptions from pipeline
step.error = StepError(
    code="llm_failure",
    message=str(e),
    failure_category="reasoning",
)
```

---

## Context Management Rules

```python
# agent/src/agent/core/context.py
# Context slots must always be separated — never merge into a single string
class WorkflowContext(BaseModel):
    # Fixed zone — never modified during a session
    system_prompt: str

    # Current turn zone — replaced every step
    current_input: str

    # History — compressed summary only (recent 10 turns max)
    history_summary: str = ""

    # Strictly forbidden: merging multiple slots into one string prompt
```

---

## Confidence Thresholds

```python
# agent/src/agent/core/confidence.py
CONFIDENCE_THRESHOLD_CERTAIN = 0.80  # → StatusConfident, proceed
CONFIDENCE_THRESHOLD_HEDGED  = 0.50  # → StatusHedged, proceed with caveat
# Below 0.50 → StatusUncertain, return UncertainInfo, do not proceed
```

---

## Current Phase Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1 — Augmented LLM | ✅ Complete | Single LLM call + StepTrace + 3-tier confidence |
| Phase 1.5 — MongoDB | ✅ Complete | ConversationRepo + TraceRepo + multi-turn |
| Infra hardening | ✅ Complete | Image pins, logging, Gemma CoT strip, trace preservation |
| **Phase 2 — Prompt Chaining** | 🔜 Next | Sequential multi-step LLM calls, chain-level trace |
| Phase 3 — Routing + Parallelization | Planned | Input classification, parallel execution, guardrails |
| Phase 4 — Autonomous Agent + HTC | Planned | 48-dim HTC features, logistic calibrator, tool use |

**Immediate next tasks (before Phase 2):**
1. History injection refactor — `WorkflowContext.to_messages()` should emit real `user`/`assistant` turns, not a flattened summary string
2. Web UI — "Trustworthy Agent Inspector" (vanilla HTML/JS/CSS, FastAPI StaticFiles)
3. llm-serving logprobs handler — remove `confidence = 0.7` default fallback

---

## Rules for Future Extensions

### When adding Tool integration (Phase 4)
- All tool calls must use `StepType.TOOL_CALL`
- Tool selection reasoning must be in `StepTrace.reasoning`
- Tool failures: `failure_category = "tool_use"`

### When adding RAG integration
- Retrieval relevance scores must be in `StepTrace.output`
- Do not proceed to generation if score is below threshold
- Log retrieval failures and generation failures as separate StepTraces

### When adding Prompt Chaining (Phase 2)
- Each LLM call in the chain = one `StepTrace`
- `DynamicsSignal.confidence_delta` must be computed across consecutive steps (currently hardcoded `0.0`)
- Gate: if intermediate confidence < 0.50, stop chain and return `StatusUncertain`

---

## What NOT To Do

- `print()` for debugging → record with `StepTrace`
- Using raw LLM response as next step input → strip CoT markers first, validate confidence
- Bare `raise Exception(...)` from pipeline code → wrap as `StepError` and return `StepTrace`
- Merging multiple context slots into one string → keep `WorkflowContext` slots separated
- Adding new features without `StepTrace`
- Calling `await self._llm.chat(...)` outside of `_call_llm()` pattern

---

## Reference Research

- HTC (Salesforce AI, 2026): Trajectory-level Confidence Calibration — arXiv:2601.15778
- AgentHallu (2026): Hallucination Attribution by Step Category
- TrajAD (2026): Trajectory Anomaly Detection
- TRACE (2026): Beyond Final-Output Evaluation
- DeepHalluBench (2026): Deep Hallucination Benchmark

---

_v0.2 · 2026.05 · Updated to reflect Phase 1.5 completion (Python/Pydantic, Gemma-4-26B)_
