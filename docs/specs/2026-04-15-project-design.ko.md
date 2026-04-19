# Trustworthy Agent Lab — Project Design Spec

> 신뢰할 수 있는 에이전트를 연구하고, 직접 구축하고, 평가하는 개인 연구·개발 프로젝트.

**Author**: Hyungrok Oh
**Date**: 2026-04-15
**Status**: Approved
**Version**: v1.0

---

## 1. Project Identity

### 1.1 Mission

"모르면 모른다고 말하고, 모든 실패를 추적 가능하게 만드는" 에이전트 시스템을 구축하고 평가한다.

이 레포지토리는 단발성 프로젝트가 아니라, **신뢰할 수 있는 에이전트에 대한 철학과 커리어를 축적하는 살아있는 레포지토리**다.
모든 설계·구현·논의는 `research/`에 정의된 에이전트 철학을 중심으로 진행한다.

### 1.2 Core Beliefs

1. 불확실할 때 멈추고 설명하는 에이전트가 항상 답하는 에이전트보다 장기적 신뢰를 쌓는다
2. 측정할 수 없는 에이전트는 개선할 수도, 배포할 수도 없다
3. 단순하고 예측 가능한 구조가 복잡한 프레임워크보다 더 큰 신뢰를 만든다

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
├── research/                        ← 연구 영역 (문서 전용)
│   ├── principles/                  ← 설계 원칙
│   ├── radar/                       ← 기술 레이더
│   ├── notes/                       ← 주간 노트
│   └── tracking/                    ← 추적 시스템
│
├── agent/                           ← 신뢰할 수 있는 에이전트 서버 (Python)
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── src/agent/
│       ├── main.py                  ← FastAPI application
│       ├── core/
│       │   ├── trace.py             ← StepTrace, TraceContext
│       │   ├── confidence.py        ← 3-tier confidence (certain/hedged/uncertain)
│       │   └── context.py           ← WorkflowContext (slot separation)
│       ├── llm/
│       │   └── client.py            ← LLM Server 호출 (logprobs 수집)
│       ├── pipeline/
│       │   └── conversation.py      ← 대화 파이프라인
│       ├── emitter/
│       │   ├── protocol.py          ← TraceEmitter Protocol (추상화)
│       │   ├── http.py              ← Eval Server로 HTTP push
│       │   └── file.py              ← 로컬 파일 기록 (개발용)
│       └── repository/
│           ├── conversation.py      ← 대화 이력 CRUD
│           └── session.py           ← 세션 상태 관리
│
├── eval/                            ← 에이전트 평가 시스템 서버 (Python)
│   ├── pyproject.toml
│   ├── Dockerfile
│   └── src/eval/
│       ├── main.py                  ← FastAPI application
│       ├── core/
│       │   ├── models.py            ← StepTrace 수신 모델
│       │   ├── metrics.py           ← ECE, Brier Score, AUROC
│       │   └── analyzer.py          ← 분석 엔진 인터페이스
│       ├── htc/
│       │   ├── features.py          ← 48-dim feature extraction
│       │   ├── calibrator.py        ← Logistic regression calibrator
│       │   └── gac.py               ← General Agent Calibrator
│       ├── collector/
│       │   └── receiver.py          ← Agent로부터 trace 수신 endpoint
│       ├── reporters/
│       │   ├── console.py           ← 터미널 리포트
│       │   └── json_report.py       ← JSON 리포트
│       └── repository/
│           ├── trace.py             ← trace 저장/조회
│           └── evaluation.py        ← 평가 결과 저장/조회
│
├── docs/
│   ├── specs/                       ← 설계 문서
│   └── index.html                   ← GitHub Pages
│
├── docker-compose.yml               ← 전체 서비스 오케스트레이션
├── .claude/CLAUDE.md
└── README.md
```

### 2.1 Three Pillars

| 영역 | 디렉토리 | 역할 | 산출물 |
|------|----------|------|--------|
| **Research** | `research/` | 설계 철학, 기술 레이더, 연구 자료 | 문서 |
| **Agent** | `agent/` | 신뢰할 수 있는 범용 대화 에이전트 | 서버 (Docker) |
| **Eval** | `eval/` | HTC 기반 에이전트 평가 시스템 | 서버 (Docker) |

각 영역은 독립적으로 관리되며, `research/`의 원칙이 `agent/`와 `eval/`의 설계를 결정한다.

---

## 3. System Architecture

### 3.1 Server Composition

| Server | Port | Location | Deployment | Responsibility |
|--------|------|----------|-----------|----------------|
| **App** | :8080 | llm-serving/web/ | Docker | UI, 사용자 인터페이스 (추후 iOS) |
| **Agent** | :8081 | trustworthy-agent-lab/agent/ | Docker | 대화 처리, StepTrace, confidence 판정 |
| **Eval** | :8090 | trustworthy-agent-lab/eval/ | Docker | trace 수신, HTC 분석, 리포트 |
| **LLM** | :8000 | llm-serving (vllm-mlx) | Host | LLM inference, logprobs |
| **MongoDB** | :27017 | — | Docker (Stateful) | 대화 이력, trace, 평가 결과 |

### 3.2 Traffic Flow

```
┌─ Docker (추후 k8s) ─────────────────────────────────────┐
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
- `Eval → LLM`: HTTP (추후 LLM-as-judge, output-level evaluation)

### 3.3 Deployment Topology

- **Docker Compose**: App, Agent, Eval, MongoDB를 컨테이너로 배포
- **Host**: vllm-mlx는 Apple Silicon 메모리 직접 접근이 필요하므로 Host에서 실행
- **Container → Host 통신**: `host.docker.internal:8000`
- **추후 k8s 전환**: LLM Server는 `ExternalService`로 등록, 나머지는 Deployment + StatefulSet(MongoDB)

---

## 4. Agent Server Design

### 4.1 Design Reference

Anthropic의 "Building Effective Agents" 가이드를 따른다:
- 단순한 프롬프트로 시작, 평가로 최적화, 단순한 방법이 부족할 때만 복잡성 추가
- 프레임워크 없이 LLM API를 직접 호출
- 투명성 우선 — 에이전트의 모든 결정 단계를 명시적으로 보여줌

### 4.2 Evolution Roadmap (Anthropic Agent Patterns)

| Phase | Pattern | Description | 추가되는 것 |
|-------|---------|-------------|------------|
| **1** | Augmented LLM | 단일 LLM 호출 + StepTrace | trace, confidence, emitter |
| **2** | Prompt Chaining | 다단계 순차 처리 | 체인 간 게이트 검증, 체이닝 trace |
| **3** | Routing + Parallelization | 입력 분류 + 병렬 실행 | 라우팅 근거 기록, 가드레일 |
| **4** | Autonomous Agent | LLM이 도구 선택·실행 | HTC calibration, tool trace |

Phase 1에 집중한다. Phase 2~4는 Phase 1이 안정된 후 점진적으로 추가.

### 4.3 Phase 1: Augmented LLM (First Milestone)

```
User Request
  → TraceContext 생성 (trace_id 발급)
  → WorkflowContext 구성 (슬롯 분리: system / session / current / history)
  → LLM 호출 (llm-serving, logprobs 포함)
  → StepTrace 기록 (input, output, confidence, dynamics, stability)
  → Confidence 판정 (certain ≥ 0.80 / hedged ≥ 0.50 / uncertain < 0.50)
  → TraceEmitter.emit(step) → Eval Server로 push
  → AgentResponse 반환 (answer + confidence + steps)
```

### 4.4 Core Types (Python)

CLAUDE.md에 정의된 Go 타입을 Python으로 구현한다.

**StepTrace** — 모든 실행 단계에 필수:

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

**AgentResponse** — 항상 confidence 포함:

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

**WorkflowContext** — 슬롯 분리 필수:

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

Agent는 eval의 존재를 직접 알지 못한다. Protocol을 통한 추상화:

```python
class TraceEmitter(Protocol):
    async def emit(self, step: StepTrace) -> None: ...
    async def flush(self, trace_id: str) -> None: ...

# 구현체는 설정으로 교체 가능
class HttpTraceEmitter:     # eval 서버로 HTTP POST (production)
class FileTraceEmitter:     # 로컬 JSON 파일 기록 (development)
class NoopTraceEmitter:     # 비활성화 (eval 서버 없을 때)
```

### 4.6 LLM Client

llm-serving의 vllm-mlx와 OpenAI-compatible API로 통신:

```python
# 요청 시 logprobs 파라미터 포함
request = {
    "model": "mlx-community/gemma-4-26B-A4B-it-4bit",
    "messages": messages,
    "temperature": 0,
    "logprobs": True,
    "top_logprobs": 5,
}
```

logprobs는 StepTrace에 기록되어 eval의 HTC feature extraction에 사용된다.

---

## 5. Eval Server Design

### 5.1 Purpose

Agent가 push한 StepTrace 데이터를 실시간으로 수신·분석하고, step-level / flow-level / output-level 평가를 수행한다.

### 5.2 HTC (Holistic Trajectory Calibration) Integration

**Reference**: "Agentic Confidence Calibration" (arXiv:2601.15778, 2026.01)

HTC는 3단계 파이프라인:

1. **Signal Collection**: 각 step의 token log-probability 수집
2. **Feature Engineering**: 궤적 전체에서 48차원 feature vector 추출
3. **Calibration**: 경량 logistic regression으로 보정된 confidence 산출

**48-dimensional Feature Space — 4 families:**

| Family | Level | Measures |
|--------|-------|----------|
| Cross-Step Dynamics | macro | step 간 confidence 변화량, 엔트로피 역전, 오류 전파 |
| Intra-Step Stability | micro | step 내 token 분산, 엔트로피, skewness |
| Positional Indicators | temporal | 첫/마지막 step 특성, 초기화 품질, 종단 수렴도 |
| Structure Attributes | structural | step 수, 궤적 길이, step별 토큰 길이 패턴 |

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

`research/principles/` 에 정의된 3-tier 계층적 진단:

**Layer 1 — Step-level Eval:**
- 각 step의 confidence 적절성 검증
- StepError 분류 (planning / reasoning / context / output)
- logprobs 기반 token-level stability 분석

**Layer 2 — Flow-level Eval:**
- TrajAD 기반 궤적 이상 패턴 탐지
- Confidence trend 분석 (increasing / stable / dropping)
- 어느 step에서 궤적이 이탈했는지 backtrace

**Layer 3 — Output-level Eval:**
- TRACE 기반 high-score illusion 방지 (최종 답이 맞아도 추론 과정 검증)
- LLM-as-judge (추후: LLM Server 호출로 최종 답변 품질 평가)
- Regression prevention (프롬프트 변경 후 기존 케이스 유지 확인)

### 5.4 Eval API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/traces` | Agent로부터 StepTrace 수신 |
| POST | `/api/traces/{trace_id}/flush` | trace 완료 신호, 분석 트리거 |
| GET | `/api/evaluations/{trace_id}` | 특정 trace의 평가 결과 조회 |
| GET | `/api/evaluations/summary` | 전체 평가 요약 리포트 |
| GET | `/api/health` | 헬스체크 |

---

## 6. Database Design (MongoDB)

### 6.1 Database Separation

하나의 MongoDB 인스턴스, 데이터베이스로 분리:

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
| Language | Python 3.13+ | 연구·프로토타이핑 속도, ML 라이브러리 생태계 |
| Package Manager | uv | 빠른 의존성 해결, lock file 지원 |
| Web Framework | FastAPI | async 지원, OpenAPI 자동 문서, llm-serving과 동일 스택 |
| Data Validation | Pydantic v2 | type-safe 모델, JSON serialization |
| Database | MongoDB (motor) | 유동적 도큐먼트 구조, CAC와 동일 선택 |
| HTTP Client | httpx | async, OpenAI-compatible API 호출 |
| Testing | pytest + pytest-asyncio | async 테스트 지원 |
| Linting | ruff | fast, comprehensive Python linter |
| Type Checking | mypy (strict) | production-level type safety |
| Deployment | Docker + docker-compose | 컨테이너 기반, 추후 k8s 전환 |

### 7.2 Code Quality Standards

- 모든 함수에 type hint 필수
- ruff로 lint/format 통일
- mypy strict mode 통과
- 핵심 로직에 단위 테스트 필수
- 구조화된 로깅 (structlog 또는 표준 logging + JSON formatter)

---

## 8. Migration Plan

### 8.1 기존 파일 이동

현재 루트에 있는 연구 문서를 `research/`로 이동:

```
principles/  → research/principles/
radar/       → research/radar/
notes/       → research/notes/
tracking/    → research/tracking/
```

### 8.2 llm-serving 변경

`gemma_client.py`에 logprobs 파라미터 추가:
- 요청: `"logprobs": True, "top_logprobs": 5`
- 응답 파싱: `choices[0].logprobs` 필드 추출
- 기존 기능에 영향 없음 (optional 파라미터)

---

## 9. Phase 1 Scope (First Milestone)

Phase 1은 **Augmented LLM** — 가장 단순한 형태에서 시작:

### 9.1 포함

- [ ] 프로젝트 구조 세팅 (research/ 이동, agent/, eval/ 생성, uv init)
- [ ] agent: StepTrace, AgentResponse, WorkflowContext 모델 정의
- [ ] agent: LLM client (llm-serving 호출, logprobs 수집)
- [ ] agent: 최소 대화 파이프라인 (요청 → LLM 호출 → 응답)
- [ ] agent: TraceEmitter Protocol + HttpTraceEmitter + FileTraceEmitter
- [ ] agent: 3-tier confidence 판정 (certain / hedged / uncertain)
- [ ] eval: trace 수신 endpoint (POST /api/traces)
- [ ] eval: 기본 step-level 메트릭 출력 (소요 시간, 성공/실패, confidence)
- [ ] docker-compose.yml (Agent + Eval + MongoDB)
- [ ] 기본 테스트

### 9.2 미포함 (Phase 2+)

- Prompt Chaining (다단계 파이프라인)
- Routing / Parallelization
- HTC 48차원 feature extraction
- HTC calibrator 학습
- LLM-as-judge (output-level eval)
- Web dashboard
- Tool integration
- RAG integration

---

## 10. Success Criteria

Phase 1 완료 조건:

1. Agent Server가 사용자 메시지를 받아 LLM 응답을 반환한다
2. 모든 LLM 호출에 StepTrace가 기록된다 (Principle 4)
3. Confidence가 threshold 미만이면 uncertain 상태로 반환된다 (Principle 5)
4. StepTrace가 Eval Server로 push된다
5. Eval Server가 수신한 trace의 기본 메트릭을 출력한다
6. docker-compose로 전체 시스템이 한 번에 기동된다

---

## References

- [Building Effective Agents — Anthropic](https://www.anthropic.com/research/building-effective-agents)
- [Agentic Confidence Calibration (arXiv:2601.15778)](https://arxiv.org/abs/2601.15778)
- AgentHallu (2026) — Hallucination attribution by step category
- TrajAD (2026) — Trajectory anomaly detection
- TRACE (2026) — Beyond final-output evaluation

---

_v1.0 · 2026-04-15 · Trustworthy Agent Lab Project Design_
