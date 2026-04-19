# Technology Radar

> 판단 필터를 통과한 기술과 개념만 이곳에 등록된다.
> 매월 말 업데이트.

**Version**: v0.1
**Last updated**: 2026.04

---

## 판단 필터 (등록 기준)

| 질문 | 기준 |
|------|------|
| 신뢰 문제를 해결하는가? | 핵심 요건 |
| 프로덕션에서 사용되고 있는가? | 필수 |
| 6개월 후에도 유효한가? | 필수 |
| 복잡성만 증가시키는가? | → Hold |
| 측정할 방법이 없는가? | → Hold |

---

## Adopt — 지금 도입

### Agent Eval Design
- **Why**: 신뢰의 기반. 측정 없이 배포할 수 없다.
- **How**: LLM-as-judge, RAGAS, step-level evaluation
- **Basis**: HTC · AgentHallu · TRACE (2026)
- **Status**: ⬜ 미적용 → 적용 예정

### .md Context Design Pattern
- **Why**: 코드 대신 자연어로 에이전트를 제어한다. CLAUDE.md, AGENTS.md 패턴.
- **How**: 프로젝트 루트에 CLAUDE.md 작성
- **Basis**: Claude Code, OpenClaw 설계 철학
- **Status**: ✅ 적용 완료 (CLAUDE.md 작성됨)

### LLM Observability
- **Why**: 운영 신뢰. 단계별 추적 없이는 디버깅이 불가능하다.
- **How**: Langfuse 또는 자체 StepTrace 구조
- **Basis**: TrajAD · 실무 경험
- **Status**: ⬜ 미적용 → 적용 예정

---

## Trial — 현재 실험 중

### Step-level Traceability (Go 구현)
- **Why**: 설계 원칙 4의 핵심 구현
- **How**: StepTrace 구조체 기반 로깅
- **Status**: 설계 완료, 구현 진행 중

---

## Assess — 관찰 중

### MCP (Model Context Protocol)
- **Why**: 도구 통합 표준화 가능성이 높다
- **Risk**: 아직 초기 단계이며, 생태계가 불확실하다
- **Reassess**: 2026년 3분기

### Prefill-Decode Separation Architecture
- **Why**: 인프라 트렌드로, 협업 논의에 유용하다
- **Risk**: 직접 구현할 가능성은 낮다
- **Reassess**: 인프라 팀과 협업 시

### On-device Agent (CoreML + MLX)
- **Why**: 블루오션. 프라이버시 우려로 수요가 증가하고 있다.
- **Risk**: 제한된 환경을 위한 설계 경험이 부족하다
- **Reassess**: 2026년 3분기, 더 깊은 탐색

---

## Hold — 지금은 아님

### LangChain / Over-abstracted Frameworks
- **Reason**: 추상화 복잡성 > 이점. 디버깅할 수 없으면 신뢰할 수 없다.
- **Reconsider**: 없음 (구조적 문제)

### General-purpose Agent Platform Rebuild
- **Reason**: 유스케이스를 먼저 검증하고, 플랫폼은 그 다음이다.
- **Reconsider**: 도메인 특화 검증 이후

---

## Changelog

| Date | Change |
|------|--------|
| 2026.04 | v0.1 초안 작성. HTC · AgentHallu · TrajAD · TRACE 기반 |

---

_매월 업데이트 · 판단 필터 기준 유지_
