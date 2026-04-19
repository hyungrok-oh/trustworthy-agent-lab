<p align="center">
  <a href="README.md"><b>English</b></a> | <a href="README.ko.md">한국어</a>
</p>

# Trustworthy Agent Lab

> A personal research and development project for designing, building, and evaluating AI agent systems that enterprises can trust.

---

## Mission

**Build and evaluate agent systems that say "I don't know" when uncertain, and make every failure traceable.**

This repository is not a one-off project — it is a living repository that accumulates philosophy and career expertise around trustworthy agents. All design, implementation, and discussion is grounded in the agent philosophy defined in `research/`.

---

## Core Beliefs

1. **An agent that admits uncertainty builds more long-term value than one that always answers confidently**
   — Long-term trust over short-term satisfaction; directly tied to contract retention in B2B

2. **An agent you can't measure is an agent you can't improve — or deploy**
   — No eval = no trust; evaluation comes before design

3. **Simple, predictable structures build more trust than complex frameworks**
   — Abstraction you can't debug = abstraction you can't trust

---

## System Architecture

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

| Server | Port | Responsibility |
|--------|------|----------------|
| **Agent** | :8081 | Conversation processing, StepTrace, confidence judgment |
| **Eval** | :8090 | Trace collection, step-level metrics, HTC analysis |
| **LLM** | :8000 | LLM inference with logprobs (host, vllm-mlx) |
| **MongoDB** | :27017 | Conversation history, trace storage |

---

## Repository Structure

```
trustworthy-agent-lab/
├── research/                         ← Research (docs only)
│   ├── principles/                   ← Design principles (EN/KO)
│   ├── radar/                        ← Technology radar (EN/KO)
│   └── tracking/                     ← Personal tracking system (EN/KO)
│
├── agent/                            ← Trustworthy agent server (Python)
│   ├── src/agent/
│   │   ├── core/                     ← StepTrace, Confidence, WorkflowContext
│   │   ├── llm/                      ← LLM client (logprobs)
│   │   ├── pipeline/                 ← Conversation pipeline
│   │   ├── emitter/                  ← TraceEmitter (HTTP/File/Noop)
│   │   └── repository/               ← MongoDB persistence
│   └── tests/                        ← 38 tests
│
├── eval/                             ← Agent evaluation server (Python)
│   ├── src/eval/
│   │   ├── core/                     ← Received models, metrics
│   │   ├── collector/                ← TraceReceiver (async)
│   │   ├── reporter/                 ← Console reporter
│   │   └── repository/               ← MongoDB persistence
│   └── tests/                        ← 17 tests
│
├── docs/
│   ├── specs/                        ← Design spec (EN/KO)
│   └── index.html                    ← GitHub Pages
│
└── docker-compose.yml                ← Full service orchestration
```

---

## Design Principles

Derived from latest research (HTC, AgentHallu, TrajAD, TRACE — 2026):

| # | Principle | Research Basis |
|---|-----------|---------------|
| 1 | Tool selection must be explainable | AgentHallu — Tool-Use Hallucination |
| 2 | Context boundaries must be explicitly designed | TrajAD — Context contamination |
| 3 | Retrieval quality must be validated before generation | DeepHalluBench / PIES |
| 4 | Every step must be independently evaluable | HTC + TRACE |
| 5 | When uncertain, stop and explain — never guess | HTC qualitative analysis |

Full details: [`research/principles/`](research/principles/trustworthy-agent-design.en.md)

---

## Tech Stack

| Component | Choice | Reason |
|-----------|--------|--------|
| Language | Python 3.13+ | Research/prototyping speed, ML ecosystem |
| Web Framework | FastAPI | Async, OpenAPI docs, same stack as llm-serving |
| Database | MongoDB (motor) | Flexible document structure |
| HTTP Client | httpx | Async, OpenAI-compatible API |
| Testing | pytest + pytest-asyncio | 55 tests, async support |
| Linting | ruff | Fast, comprehensive |
| Deployment | Docker + docker-compose | Container-based, future k8s migration |

---

## Evolution Roadmap

| Phase | Pattern | Status |
|-------|---------|--------|
| **1** | Augmented LLM — single LLM call + StepTrace | Done |
| **1.5** | MongoDB persistence + multi-turn sessions | Done |
| **2** | Prompt Chaining — multi-step sequential LLM calls | Planned |
| **3** | Routing + Parallelization | Planned |
| **4** | Autonomous Agent + HTC calibration | Planned |

---

## Live Report

[Trustworthy Agent Lab Report](https://hyungrok-oh.github.io/trustworthy-agent-lab/)

---

## References

- [Building Effective Agents — Anthropic](https://www.anthropic.com/research/building-effective-agents)
- [Agentic Confidence Calibration (arXiv:2601.15778)](https://arxiv.org/abs/2601.15778)
- AgentHallu (2026) — Hallucination attribution by step category
- TrajAD (2026) — Trajectory anomaly detection
- TRACE (2026) — Beyond final-output evaluation

---

_Started: 2026.04 · Hyungrok Oh · Based on hands-on experience + latest research_
