<p align="center">
  <a href="README.md">English</a> | <a href="README.ko.md"><b>한국어</b></a>
</p>

# Trustworthy Agent Lab

> 신뢰할 수 있는 AI 에이전트 시스템을 연구하고, 직접 구축하고, 평가하는 개인 연구·개발 프로젝트.

---

## Mission

**"모르면 모른다고 말하고, 모든 실패를 추적 가능하게 만드는" 에이전트 시스템을 구축하고 평가한다.**

이 레포지토리는 단발성 프로젝트가 아니라, 신뢰할 수 있는 에이전트에 대한 철학과 커리어를 축적하는 살아있는 레포지토리다. 모든 설계·구현·논의는 `research/`에 정의된 에이전트 철학을 중심으로 진행한다.

---

## 핵심 신념

1. **불확실할 때 멈추고 설명하는 에이전트가 항상 답하는 에이전트보다 장기적 신뢰를 쌓는다**
   — 단기 만족보다 장기 신뢰; B2B에서 계약 유지에 직접적으로 연결

2. **측정할 수 없는 에이전트는 개선할 수도, 배포할 수도 없다**
   — 평가 없이는 신뢰 없음; 평가가 설계보다 먼저

3. **단순하고 예측 가능한 구조가 복잡한 프레임워크보다 더 큰 신뢰를 만든다**
   — 디버깅할 수 없는 추상화는 신뢰할 수 없는 추상화

---

## 시스템 아키텍처

```
┌─ Docker ────────────────────────────────────────────┐
│                                                      │
│  ┌────────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │   Agent    │  │   Eval   │  │    MongoDB      │ │
│  │   :8081    │  │  :8090   │  │    :27017       │ │
│  └──┬─────┬───┘  └──▲───┬───┘  └──▲──────────────┘ │
│     │     │  trace   │   │  read/  │                │
│     │     │  push    │   │  write  │                │
│     │     └──────────┘   └─────────┘                │
└─────┼───────────────────────────────────────────────┘
      │  host.docker.internal
┌─────▼───────────────┐
│    LLM Server       │
│   vllm-mlx :8000    │
└─────────────────────┘
```

| 서버 | 포트 | 역할 |
|------|------|------|
| **Agent** | :8081 | 대화 처리, StepTrace, confidence 판정 |
| **Eval** | :8090 | trace 수신, step-level 메트릭, HTC 분석 |
| **LLM** | :8000 | LLM 추론 + logprobs (Host, vllm-mlx) |
| **MongoDB** | :27017 | 대화 이력, trace 저장 |

---

## 레포지토리 구조

```
trustworthy-agent-lab/
├── research/                         ← 연구 영역 (문서 전용)
│   ├── principles/                   ← 설계 원칙 (EN/KO)
│   ├── radar/                        ← 기술 레이더 (EN/KO)
│   └── tracking/                     ← 개인 추적 시스템 (EN/KO)
│
├── agent/                            ← 신뢰할 수 있는 에이전트 서버 (Python)
│   ├── src/agent/
│   │   ├── core/                     ← StepTrace, Confidence, WorkflowContext
│   │   ├── llm/                      ← LLM 클라이언트 (logprobs)
│   │   ├── pipeline/                 ← 대화 파이프라인
│   │   ├── emitter/                  ← TraceEmitter (HTTP/File/Noop)
│   │   └── repository/               ← MongoDB 영속성
│   └── tests/                        ← 38개 테스트
│
├── eval/                             ← 에이전트 평가 시스템 서버 (Python)
│   ├── src/eval/
│   │   ├── core/                     ← 수신 모델, 메트릭
│   │   ├── collector/                ← TraceReceiver (async)
│   │   ├── reporter/                 ← 콘솔 리포터
│   │   └── repository/               ← MongoDB 영속성
│   └── tests/                        ← 17개 테스트
│
├── docs/
│   ├── specs/                        ← 설계 문서 (EN/KO)
│   └── index.html                    ← GitHub Pages
│
└── docker-compose.yml                ← 전체 서비스 오케스트레이션
```

---

## 설계 원칙

최신 연구 기반 (HTC, AgentHallu, TrajAD, TRACE — 2026):

| # | 원칙 | 연구 근거 |
|---|------|----------|
| 1 | 도구 선택은 설명 가능해야 한다 | AgentHallu — Tool-Use Hallucination |
| 2 | 컨텍스트 경계는 명시적으로 설계해야 한다 | TrajAD — 컨텍스트 오염 |
| 3 | 검색 품질은 생성 전에 검증해야 한다 | DeepHalluBench / PIES |
| 4 | 모든 단계는 독립적으로 평가 가능해야 한다 | HTC + TRACE |
| 5 | 불확실할 때는 멈추고 설명한다 — 절대 추측하지 않는다 | HTC 정성 분석 |

상세: [`research/principles/`](research/principles/trustworthy-agent-design.ko.md)

---

## 기술 스택

| 구성요소 | 선택 | 이유 |
|---------|------|------|
| 언어 | Python 3.13+ | 연구·프로토타이핑 속도, ML 생태계 |
| 웹 프레임워크 | FastAPI | async 지원, OpenAPI 자동 문서 |
| 데이터베이스 | MongoDB (motor) | 유동적 도큐먼트 구조 |
| HTTP 클라이언트 | httpx | async, OpenAI-compatible API |
| 테스트 | pytest + pytest-asyncio | 55개 테스트, async 지원 |
| 린터 | ruff | 빠르고 포괄적 |
| 배포 | Docker + docker-compose | 컨테이너 기반, 추후 k8s 전환 |

---

## 진화 로드맵

| Phase | 패턴 | 상태 |
|-------|------|------|
| **1** | Augmented LLM — 단일 LLM 호출 + StepTrace | 완료 |
| **1.5** | MongoDB 영속성 + 멀티턴 세션 | 완료 |
| **2** | Prompt Chaining — 다단계 순차 LLM 호출 | 예정 |
| **3** | Routing + Parallelization | 예정 |
| **4** | Autonomous Agent + HTC calibration | 예정 |

---

## Live Report

[Trustworthy Agent Lab Report](https://hyungrok-oh.github.io/trustworthy-agent-lab/)

---

## 참고 문헌

- [Building Effective Agents — Anthropic](https://www.anthropic.com/research/building-effective-agents)
- [Agentic Confidence Calibration (arXiv:2601.15778)](https://arxiv.org/abs/2601.15778)
- AgentHallu (2026) — 단계별 환각 원인 분류
- TrajAD (2026) — 궤적 이상 탐지
- TRACE (2026) — 최종 출력을 넘어선 평가

---

_시작: 2026.04 · Hyungrok Oh · 실무 경험 + 최신 연구 기반_
