# Trustworthy Agent Lab — Project Design Spec

> A personal research and development project for studying, building, and evaluating trustworthy agents.

**Author**: Hyungrok Oh
**Date**: 2026-04-15
**Status**: Approved
**Version**: v1.0

---

## 1. Project Identity

### 1.1 Mission

Build and evaluate an agent system that "says 'I don't know' when it doesn't know, and makes every failure traceable."

This repository is not a one-off project — it is a **living repository that accumulates philosophy and career expertise around trustworthy agents**.
All design, implementation, and discussion is driven by the agent philosophy defined in `research/`.

### 1.2 Core Beliefs

1. An agent that stops and explains when uncertain builds more long-term trust than one that always provides an answer
2. An agent that cannot be measured cannot be improved or deployed
3. Simple, predictable structures create greater trust than complex frameworks

### 1.3 Design Principles (from `research/principles/`)

| # | Principle | Research Basis |
|---|-----------|---------------|
| 1 | Tool selection must be explainable | AgentHallu — Tool-Use Hallucination |
| 2 | Context boundaries must be explicitly designed | TrajAD — Context contamination |
| 3 | Retrieval quality must be validated before generation | DeepHalluBench / PIES |
| 4 | Every step must be independently evaluable | HTC + TRACE |
| 5 | When uncertain, stop and explain — never guess | HTC qualitative analysis |

---

## 2. Repository Structure

```
trustworthy-agent-lab/
│
├── research/                        ← Research area (documentation only)
│   ├── principles/                  ← Design principles
│   ├── radar/                       ← Technology radar
│   ├── notes/                       ← Weekly notes
│   └── tracking/                    ← Tracking system
│
├── agent/                           ← Trustworthy agent server (Python)
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── src/agent/
│       ├── main.py                  ← FastAPI application
│       ├── core/
│       │   ├── trace.py             ← StepTrace, TraceContext
│       │   ├── confidence.py        ← 3-tier confidence (certain/hedged/uncertain)
│       │   └── context.py           ← WorkflowContext (slot separation)
│       ├── llm/
│       │   └── client.py            ← LLM Server calls (logprobs collection)
│       ├── pipeline/
│       │   └── conversation.py      ← Conversation pipeline
│       ├── emitter/
│       │   ├── protocol.py          ← TraceEmitter Protocol (abstraction)
│       │   ├── http.py              ← HTTP push to Eval Server
│       │   └── file.py              ← Local file logging (for development)
│       └── repository/
│           ├── conversation.py      ← Conversation history CRUD
│           └── session.py           ← Session state management
│
├── eval/                            ← Agent evaluation system server (Python)
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── src/eval/
│       ├── main.py                  ← FastAPI application
│       ├── core/
│       │   ├── models.py            ← StepTrace ingestion models
│       │   ├── metrics.py           ← ECE, Brier Score, AUROC
│       │   └── analyzer.py          ← Analysis engine interface
│       ├── htc/
│       │   ├── features.py          ← 48-dim feature extraction
│       │   ├── calibrator.py        ← Logistic regression calibrator
│       │   └── gac.py               ← General Agent Calibrator
│       ├── collector/
│       │   └── receiver.py          ← Trace ingestion endpoint from Agent
│       ├── reporters/
│       │   ├── console.py           ← Terminal report
│       │   └── json_report.py       ← JSON report
│       └── repository/
│           ├── trace.py             ← Trace storage/retrieval
│           └── evaluation.py        ← Evaluation result storage/retrieval
│
├── docs/
│   ├── specs/                       ← Design documents
│   └── index.html                   ← GitHub Pages
│
├── docker-compose.yml               ← Full service orchestration
├── .claude/CLAUDE.md
└── README.md
```

### 2.1 Three Pillars

| Area | Directory | Role | Output |
|------|-----------|------|--------|
| **Research** | `research/` | Design philosophy, technology radar, research materials | Documentation |
| **Agent** | `agent/` | Trustworthy general-purpose conversational agent | Server (Docker) |
| **Eval** | `eval/` | HTC-based agent evaluation system | Server (Docker) |

Each area is managed independently, and the principles in `research/` drive the design of `agent/` and `eval/`.

---

## 3. System Architecture

### 3.1 Server Composition

| Server | Port | Location | Deployment | Responsibility |
|--------|------|----------|-----------|----------------|
| **App** | :8080 | llm-serving/web/ | Docker | UI, user interface (iOS planned) |
| **Agent** | :8081 | trustworthy-agent-lab/agent/ | Docker | Conversation processing, StepTrace, confidence evaluation |
| **Eval** | :8090 | trustworthy-agent-lab/eval/ | Docker | Trace ingestion, HTC analysis, reporting |
| **LLM** | :8000 | llm-serving (vllm-mlx) | Host | LLM inference, logprobs |
| **MongoDB** | :27017 | — | Docker (Stateful) | Conversation history, traces, evaluation results |

### 3.2 Traffic Flow

```
┌─ Docker (k8s planned) ──────────────────────────────────┐
│                                                          │
│  ┌────────┐  ┌────────────┐  ┌──────────┐  ┌─────────┐ │
│  │  App   │  │   Agent    │  │   Eval   │  │ MongoDB │ │
│  │ :8080  │  │   :8081    │  │  :8090   │  │ :27017  │ │
│  └───┬────┘  └──┬─────┬───┘  └──▲───┬───┘  └──▲──────┘ │
│      │          │     │         │   │         │         │
│      └──────────┘     │   trace │   │  read/  │         │
│       user request    │   push  │   │  write  │         │
│                       │         │   └─────────┘         │
│                       │         │                       │
└───────────────────────┼─────────┼───────────────────────┘
                        │         │
                 host.docker.internal
                        │         │
                 ┌──────▼─────────▼──┐
                 │    LLM Server     │
                 │   vllm-mlx :8000  │
                 │  Gemma-4-26B-it   │
                 │   (Host, logprobs)│
                 └───────────────────┘
```

**Communication patterns:**
- `App → Agent`: HTTP (user request/response)
- `Agent → LLM`: HTTP, OpenAI-compatible API (chat completions + logprobs)
- `Agent → Eval`: HTTP POST (StepTrace push, OpenTelemetry pattern)
- `Agent → MongoDB`: conversation history, session state
- `Eval → MongoDB`: trace storage, evaluation results
- `Eval → LLM`: HTTP (LLM-as-judge planned, output-level evaluation)

### 3.3 Deployment Topology

- **Docker Compose**: Deploys App, Agent, Eval, and MongoDB as containers
- **Host**: vllm-mlx runs on the host since it requires direct access to Apple Silicon memory
- **Container → Host communication**: `host.docker.internal:8000`
- **Future k8s migration**: LLM Server registered as `ExternalService`; others deployed as Deployment + StatefulSet (MongoDB)

---

## 4. Agent Server Design

### 4.1 Design Reference

Follows Anthropic's "Building Effective Agents" guide:
- Start with simple prompts, optimize through evaluation, add complexity only when simpler methods fall short
- Call LLM APIs directly without frameworks
- Transparency first — explicitly show every decision step of the agent

### 4.2 Evolution Roadmap (Anthropic Agent Patterns)

| Phase | Pattern | Description | What Gets Added |
|-------|---------|-------------|-----------------|
| **1** | Augmented LLM | Single LLM call + StepTrace | trace, confidence, emitter |
| **2** | Prompt Chaining | Multi-step sequential processing | Gate verification between chains, chaining trace |
| **3** | Routing + Parallelization | Input classification + parallel execution | Routing rationale logging, guardrails |
| **4** | Autonomous Agent | LLM selects and executes tools | HTC calibration, tool trace |

Focus on Phase 1. Phases 2-4 will be added incrementally after Phase 1 stabilizes.

### 4.3 Phase 1: Augmented LLM (First Milestone)

```
User Request
  → Create TraceContext (issue trace_id)
  → Build WorkflowContext (slot separation: system / session / current / history)
  → Call LLM (llm-serving, including logprobs)
  → Record StepTrace (input, output, confidence, dynamics, stability)
  → Evaluate Confidence (certain ≥ 0.80 / hedged ≥ 0.50 / uncertain < 0.50)
  → TraceEmitter.emit(step) → push to Eval Server
  → Return AgentResponse (answer + confidence + steps)
```

### 4.4 Core Types (Python)

Implements the Go types defined in CLAUDE.md in Python.

**StepTrace** — Required for every execution step:

```python
class StepTrace(BaseModel):
    trace_id: str
    step_id: int
    step_type: StepType           # llm_call | workflow | decision | tool_call
    is_first: bool
    is_last: bool

    input: dict[str, Any]
    output: dict[str, Any]
    error: StepError | None = None

    confidence: float             # 0.0 ~ 1.0
    reasoning: str

    dynamics: DynamicsSignal      # cross-step: confidence_delta, trend
    stability: StabilitySignal    # intra-step: output_consistency

    anomaly: AnomalySignal | None = None

    started_at: datetime
    duration_ms: float

    # HTC extension
    logprobs: list[list[float]] | None = None  # token-level log-probabilities
```

**AgentResponse** — Always includes confidence:

```python
class AgentResponse(BaseModel):
    trace_id: str
    status: ResponseStatus        # confident | hedged | uncertain
    answer: str | None = None

    confidence: float
    caveat: str | None = None
    uncertainty: UncertainInfo | None = None

    steps: list[StepTrace]
```

**WorkflowContext** — Slot separation is mandatory:

```python
class WorkflowContext(BaseModel):
    # Fixed zone — never modified
    system_prompt: str
    workflow_def: dict[str, Any]

    # Session zone — verified facts only
    session_facts: list[Fact]

    # Current turn zone — replaced every step
    current_input: str
    current_step_idx: int

    # History — compressed summary only
    history_summary: str
```

### 4.5 TraceEmitter (OpenTelemetry Pattern)

The Agent has no direct knowledge of Eval's existence. Abstraction through Protocol:

```python
class TraceEmitter(Protocol):
    async def emit(self, step: StepTrace) -> None: ...
    async def flush(self, trace_id: str) -> None: ...

# Implementations are swappable via configuration
class HttpTraceEmitter:     # HTTP POST to eval server (production)
class FileTraceEmitter:     # Local JSON file logging (development)
class NoopTraceEmitter:     # Disabled (when eval server is unavailable)
```

### 4.6 LLM Client

Communicates with llm-serving's vllm-mlx via OpenAI-compatible API:

```python
# Include logprobs parameter in requests
request = {
    "model": "mlx-community/gemma-4-26B-A4B-it-4bit",
    "messages": messages,
    "temperature": 0,
    "logprobs": True,
    "top_logprobs": 5,
}
```

logprobs are recorded in StepTrace and used by Eval's HTC feature extraction.

---

## 5. Eval Server Design

### 5.1 Purpose

Receives StepTrace data pushed by the Agent in real time, analyzes it, and performs step-level / flow-level / output-level evaluation.

### 5.2 HTC (Holistic Trajectory Calibration) Integration

**Reference**: "Agentic Confidence Calibration" (arXiv:2601.15778, 2026.01)

HTC is a 3-stage pipeline:

1. **Signal Collection**: Collect token log-probabilities from each step
2. **Feature Engineering**: Extract a 48-dimensional feature vector from the entire trajectory
3. **Calibration**: Produce calibrated confidence using lightweight logistic regression

**48-dimensional Feature Space — 4 families:**

| Family | Level | Measures |
|--------|-------|----------|
| Cross-Step Dynamics | macro | Confidence delta between steps, entropy reversal, error propagation |
| Intra-Step Stability | micro | Token variance within a step, entropy, skewness |
| Positional Indicators | temporal | First/last step characteristics, initialization quality, terminal convergence |
| Structure Attributes | structural | Step count, trajectory length, per-step token length patterns |

**StepTrace fields → HTC feature mapping:**

| StepTrace Field | HTC Feature Family |
|----------------|--------------------|
| `dynamics.confidence_delta`, `dynamics.trend` | Cross-Step Dynamics |
| `stability.output_consistency` | Intra-Step Stability |
| `is_first`, `is_last` | Positional Indicators |
| `step_id`, `duration_ms` | Structure Attributes |
| `logprobs` | All families (raw signal source) |
| `anomaly` | Anomaly detection output |

**Calibration formula:**

```
𝒞_𝒯 = σ(wᵀx + b)

where:
  𝒞_𝒯 = calibrated confidence ∈ [0, 1]
  x   = 48-dimensional feature vector
  w   = learned weights
  σ   = sigmoid function
```

### 5.3 Three-Layer Evaluation

Three-tier hierarchical diagnostics defined in `research/principles/`:

**Layer 1 — Step-level Eval:**
- Verify confidence appropriateness for each step
- Classify StepErrors (planning / reasoning / context / output)
- Token-level stability analysis based on logprobs

**Layer 2 — Flow-level Eval:**
- Trajectory anomaly pattern detection based on TrajAD
- Confidence trend analysis (increasing / stable / dropping)
- Backtrace to identify which step caused the trajectory to deviate

**Layer 3 — Output-level Eval:**
- Prevent high-score illusions based on TRACE (verify reasoning process even when the final answer is correct)
- LLM-as-judge (planned: evaluate final answer quality by calling LLM Server)
- Regression prevention (verify existing cases still pass after prompt changes)

### 5.4 Eval API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/traces` | Receive StepTrace from Agent |
| POST | `/api/traces/{trace_id}/flush` | Trace completion signal, triggers analysis |
| GET | `/api/evaluations/{trace_id}` | Retrieve evaluation results for a specific trace |
| GET | `/api/evaluations/summary` | Overall evaluation summary report |
| GET | `/api/health` | Health check |

---

## 6. Database Design (MongoDB)

### 6.1 Database Separation

Single MongoDB instance, separated by database:

**agent_db:**

```
conversations {
    _id: ObjectId
    session_id: string (index)
    messages: [
        { role: "user"|"assistant", content: string, timestamp: datetime }
    ]
    created_at: datetime
    updated_at: datetime
    ttl_expire_at: datetime (TTL index, 7 days)
}

sessions {
    _id: ObjectId
    session_id: string (unique index)
    state: string
    turn_count: int
    created_at: datetime
    updated_at: datetime
}
```

**eval_db:**

```
traces {
    _id: ObjectId
    trace_id: string (unique index)
    steps: [StepTrace]
    agent_response: AgentResponse
    received_at: datetime
    analyzed: boolean (index)
}

evaluations {
    _id: ObjectId
    trace_id: string (unique index)
    step_metrics: [{ step_id: int, ... }]
    flow_metrics: { confidence_trend: string, anomalies: [...] }
    htc_features: [float] (48-dim)
    calibrated_confidence: float
    evaluated_at: datetime
}
```

---

## 7. Development Environment

### 7.1 Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Language | Python 3.13+ | Research/prototyping speed, ML library ecosystem |
| Package Manager | uv | Fast dependency resolution, lock file support |
| Web Framework | FastAPI | Async support, automatic OpenAPI docs, same stack as llm-serving |
| Data Validation | Pydantic v2 | Type-safe models, JSON serialization |
| Database | MongoDB (motor) | Flexible document structure, same choice as CAC |
| HTTP Client | httpx | Async, OpenAI-compatible API calls |
| Testing | pytest + pytest-asyncio | Async test support |
| Linting | ruff | Fast, comprehensive Python linter |
| Type Checking | mypy (strict) | Production-level type safety |
| Deployment | Docker + docker-compose | Container-based, future k8s migration |

### 7.2 Code Quality Standards

- Type hints required for all functions
- Unified lint/format with ruff
- Must pass mypy strict mode
- Unit tests required for core logic
- Structured logging (structlog or standard logging + JSON formatter)

---

## 8. Migration Plan

### 8.1 Existing File Relocation

Move research documents currently at root to `research/`:

```
principles/  → research/principles/
radar/       → research/radar/
notes/       → research/notes/
tracking/    → research/tracking/
```

### 8.2 llm-serving Changes

Add logprobs parameter to `gemma_client.py`:
- Request: `"logprobs": True, "top_logprobs": 5`
- Response parsing: Extract `choices[0].logprobs` field
- No impact on existing functionality (optional parameter)

---

## 9. Phase 1 Scope (First Milestone)

Phase 1 is **Augmented LLM** — starting from the simplest form:

### 9.1 Included

- [ ] Project structure setup (move research/, create agent/ and eval/, uv init)
- [ ] agent: Define StepTrace, AgentResponse, WorkflowContext models
- [ ] agent: LLM client (call llm-serving, collect logprobs)
- [ ] agent: Minimal conversation pipeline (request → LLM call → response)
- [ ] agent: TraceEmitter Protocol + HttpTraceEmitter + FileTraceEmitter
- [ ] agent: 3-tier confidence evaluation (certain / hedged / uncertain)
- [ ] eval: Trace ingestion endpoint (POST /api/traces)
- [ ] eval: Basic step-level metric output (duration, success/failure, confidence)
- [ ] docker-compose.yml (Agent + Eval + MongoDB)
- [ ] Basic tests

### 9.2 Not Included (Phase 2+)

- Prompt Chaining (multi-step pipeline)
- Routing / Parallelization
- HTC 48-dimensional feature extraction
- HTC calibrator training
- LLM-as-judge (output-level eval)
- Web dashboard
- Tool integration
- RAG integration

---

## 10. Success Criteria

Phase 1 completion conditions:

1. Agent Server receives user messages and returns LLM responses
2. Every LLM call has a StepTrace recorded (Principle 4)
3. When confidence is below threshold, response is returned with uncertain status (Principle 5)
4. StepTrace is pushed to Eval Server
5. Eval Server outputs basic metrics for received traces
6. Entire system starts with a single docker-compose command

---

## References

- [Building Effective Agents — Anthropic](https://www.anthropic.com/research/building-effective-agents)
- [Agentic Confidence Calibration (arXiv:2601.15778)](https://arxiv.org/abs/2601.15778)
- AgentHallu (2026) — Hallucination attribution by step category
- TrajAD (2026) — Trajectory anomaly detection
- TRACE (2026) — Beyond final-output evaluation

---

_v1.0 · 2026-04-15 · Trustworthy Agent Lab Project Design_
