# HANDOFF — Trustworthy Agent Lab

> 다른 로컬 환경에서 작업을 이어가기 위한 핸드오프 문서.
> **자주 갱신되는 살아있는 문서** — `docs/specs/`의 박제된 설계 문서와 성격이 다름.

**Last updated**: 2026-05-25
**Last commit on main**: `3ad108f chore: gitignore .claude/ directory`
**Current phase**: Phase 1.5 완료, Phase 2 진입 전 정리 작업 중

---

## 0. TL;DR (30초 컷)

- ✅ **Phase 1.5 완료** — 단일 LLM 호출 + StepTrace + MongoDB 영속화 + 멀티턴
- 🔧 **즉시 이어갈 작업 3건** (§3 참조) — 모두 Phase 2 진입 전 마무리해야 함
- ✅ **ADR-001 결정 완료** (§5 참조) — Context slot 직렬화 전략 확정. 다음 PC에서는 구현부터 시작 가능
- 🧹 **코드베이스 청결도**: TODO/FIXME 0건, skipped test 0건, 14개 테스트 파일 모두 활성

---

## 1. 환경 부트스트랩 (다른 머신에서 처음 열 때)

```bash
# 1. Clone
git clone <repo-url> && cd trustworthy-agent-lab

# 2. LLM 서버는 호스트에서 별도 실행 (vllm-mlx, port 8000)
#    Gemma-4-26B-A4B-it-4bit (mlx-community)
#    docker-compose에는 포함되지 않음 — 별도 기동 필요

# 3. Agent + Eval + MongoDB
docker compose up -d

# 4. 헬스체크
curl localhost:8081/api/health   # agent
curl localhost:8090/api/health   # eval

# 5. 테스트 (각 서비스 디렉토리에서)
cd agent && pytest
cd eval  && pytest
```

**주의**: 에어갭 환경 — `pip install`, `npm install` 등 외부 네트워크 의존 명령 금지.
의존성은 이미지에 빌트인. 코드 변경만으로 충분.

---

## 2. 시스템 구조 스냅샷

| 서비스 | 포트 | 디렉토리 | 책임 |
|--------|------|----------|------|
| Agent Server | 8081 | `agent/` | 대화 파이프라인, StepTrace 생성·송출 |
| Eval Server  | 8090 | `eval/`  | 트레이스 수신, 메트릭, MongoDB 영속화 |
| LLM Server   | 8000 | (호스트) | vllm-mlx, Gemma-4-26B |
| MongoDB      | 27017 | Docker volume | `agent_db`, `eval_db` |

**현재 구현된 엔드포인트**:
- `POST /api/chat` (agent) — 단일 LLM 호출 파이프라인
- `POST /api/traces` (eval) — async 수신, 버퍼 flush 시 MongoDB persist
- `GET /api/health` (양쪽)

핵심 모듈:
- `agent/src/agent/core/{trace,confidence,context}.py` — 타입 정의
- `agent/src/agent/pipeline/conversation.py` — 단일 step 파이프라인
- `agent/src/agent/emitter/{http,file}.py` — 트레이스 송출
- `eval/src/eval/collector/receiver.py` — async 수신 + flush

---

## 3. 즉시 이어갈 작업 (Phase 2 진입 전)

### 3.1 ✅ History injection refactor — **설계 결정 완료 (ADR-001)**, 구현 대기
- **파일**: `agent/src/agent/core/context.py:62-85`, `agent/src/agent/pipeline/conversation.py` (`_call_llm`)
- **합의된 방향 (ADR-001, §5 참조)**:
  - System zone(`system_prompt` + `session_facts` + `history_summary`)은 **section header를 가진 단일 system 메시지**로 직렬화 유지 (현재 코드 방식 그대로)
  - **Recent N개 turn은 real `user`/`assistant` 메시지로 추가**
  - Slot 분리는 *데이터 모델*과 *`StepTrace.input` dict*에서 보장 (wire format에서 강제하지 않음)
- **구현 체크리스트**:
  - [ ] `core/context.py`에 `Turn` 모델 추가 (`role: Literal["user","assistant"]`, `content: str`)
  - [ ] `WorkflowContext`에 `recent_turns: list[Turn] = []` 필드 신설
  - [ ] `to_messages()`가 recent_turns를 진짜 user/assistant 메시지로 삽입하도록 수정
  - [ ] `pipeline/conversation.py`의 `_call_llm`에서 `StepTrace.input`을 slot dict로 확장:
        `{"system_prompt": ..., "facts": [...], "summary": ..., "recent_turns": [...], "current_input": ...}`
        (현재 `{"prompt": workflow_ctx.current_input}`만 있어 slot identity 손실 — 이게 진짜 Principle 3 위반 포인트)
  - [ ] `recent_turns`를 채우는 로직 추적: `agent/src/agent/repository/conversation.py` + main의 chat handler에서 history를 읽어와 WorkflowContext를 만드는 위치 확인 후, summary 대신/와 함께 recent_turns로 주입
  - [ ] `test_context.py` 보강 — recent_turns 케이스, slot 순서, role alternation 테스트
  - [ ] `test_pipeline.py` 보강 — StepTrace.input의 slot dict 검증
- **임시 결정**: N = ∞ (요약 안 함, recent_turns만 채움). 실제 요약 로직(N 초과분 → history_summary)은 **Phase 2의 첫 chain 사례**로 구현. 지금은 history_summary 필드를 빈 채로 둠.
- **거부된 대안**:
  - Multi-system 메시지로 slot마다 별도 system role 부여 → Gemma 학습 분포와 어긋남, OOD 입력, Principle 4 위반
  - History를 전부 user/assistant fake turn으로 → 압축 요약은 turn으로 표현 불가, slot identity 손실

### 3.2 🔧 llm-serving logprobs fallback 제거
- **파일**: `agent/src/agent/pipeline/conversation.py:180-189`
- **현재 코드**:
  ```python
  if not logprobs:
      return 0.7  # default when logprobs unavailable
  ...
  if not top1_probs:
      return 0.7
  ```
- **문제**: Principle 2 위반. logprobs가 없으면 "모른다"고 해야지 0.7을 지어내면 안 됨.
- **해야 할 것**:
  1. llm-serving이 logprobs를 항상 반환하도록 보장 (vllm-mlx config 확인)
  2. 그래도 없는 경우 → `confidence=0.0` + `StepError(failure_category="output")` 로 표시하거나, 호출 자체를 실패 처리
  3. 0.7 magic number를 코드에서 완전히 제거
- **상태**: 미착수.

### 3.3 🆕 Web UI — "Trustworthy Agent Inspector"
- **파일**: 존재하지 않음. `agent/static/` 또는 `agent/ui/` 디렉토리 신설.
- **현재 상태**: Zero. FastAPI에 `StaticFiles` 마운트 없음.
- **요구사항**: vanilla HTML/JS/CSS only (네트워크 의존 없음). FastAPI `StaticFiles`로 서빙.
- **목표**: trace_id 기반으로 StepTrace 시각화. confidence/dynamics/stability 차트, step별 input/output 토글, error 카테고리 색상 코딩.
- **상태**: 그린필드. 의존성 없음. 언제든 시작 가능.

---

## 4. Phase 로드맵 — 현재 위치

| Phase | 상태 | 핵심 산출물 |
|-------|------|------------|
| Phase 1 — Augmented LLM | ✅ 완료 | 단일 LLM 호출 + StepTrace + 3-tier confidence |
| Phase 1.5 — MongoDB | ✅ 완료 | ConversationRepo + TraceRepo + 멀티턴 |
| Infra hardening | ✅ 완료 | 이미지 pin, 로깅, Gemma CoT strip, trace preservation |
| **§3의 정리 작업 3건** | 🔧 진행 중 | history 설계 결정, logprobs fallback, Web UI |
| **Phase 2 — Prompt Chaining** | 🔜 다음 | 순차 multi-step, chain-level trace, confidence gating |
| Phase 3 — Routing + Parallelization | 📋 계획 | 입력 분류, 병렬 실행, guardrails |
| Phase 4 — Autonomous Agent + HTC | 📋 계획 | 48-dim HTC, logistic calibrator, tool use |

### Phase 2 진입 시 필요한 작업 (아직 미설계)
- `pipeline/chain.py` 신설 — sequential step orchestrator
- `DynamicsSignal.confidence_delta` 실제 계산 (현재 hardcoded `0.0`)
- Chain-level gating: 중간 confidence < 0.50이면 chain 중단 + `StatusUncertain` 반환
- Phase 2 spec 문서를 `docs/specs/2026-MM-DD-phase2-prompt-chaining.md`로 박제

### Phase 3/4 — 설계 자료 부재
- `research/principles/` 의 원칙은 모든 phase를 커버하지만, Phase 3/4 구체 설계 문서 없음.
- HTC 48-dim feature 명세는 `research/`에 reference만 존재 (arXiv:2601.15778).

---

## 5. 설계 결정 기록 (ADR)

### ADR-001: Context slot serialization — ✅ Resolved (2026-05-25)

**Status**: Accepted (대화 세션에서 합의, 구현 미진행)

**Context**:
현재 `WorkflowContext.to_messages()`는 `system_prompt + session_facts + history_summary`를 단일 system 메시지에 section header로 구분해서 concat한다. CLAUDE.md "Immediate next tasks #1"은 history를 "real user/assistant turns"로 emit하라고 요구해서 표면적으로 충돌하는 듯 보였음. 더 깊이 들여다보니 진짜 질문은 두 가지:
1. Slot 분리는 wire format 수준에서 강제해야 하는가, 데이터 모델 + trace 수준에서 강제하면 충분한가?
2. History는 어떤 형태로 보관할 것인가 (요약만? 원본 turn? 하이브리드?)

**Decision**:

| 항목 | 결정 |
|------|------|
| Slot 분리의 강제 위치 | **데이터 모델(`WorkflowContext` 필드 분리) + `StepTrace.input` dict 키 분리**. Wire format(LLM 입력 prompt)에서는 강제하지 않음. |
| System zone 직렬화 | `system_prompt` + `session_facts` + `history_summary`는 **section header(`[Session Facts]`, `[Earlier Summary]`)를 가진 단일 system 메시지**로 concat. 현재 코드 방식 유지. |
| 최근 turn 처리 | **Recent N개 turn은 real `user`/`assistant` 메시지로 추가**. `WorkflowContext.recent_turns: list[Turn]` 필드 신설. |
| 요약 시점 | **임시안: N = ∞** (요약 안 함, recent_turns만 채움). 실제 요약(N 초과분 → `history_summary`)은 **Phase 2의 첫 prompt chain 사례**로 구현. |

**Rationale**:
1. Principle 3의 진짜 위협 모델은 *"어느 slot이 망쳤는지 추적 불가"*. 이는 데이터 모델 + `StepTrace.input` slot dict로 충분히 완화됨. Wire format은 audit 대상이 아님.
2. Multi-system 메시지로 slot마다 별도 system role을 주는 방식은 — Gemma를 포함한 instruction-tuned 모델의 학습 분포(single system + alternating turns)와 어긋남. OOD 입력은 신뢰성을 명분으로 신뢰성을 깎는 자기모순.
3. `[Session Facts]`, `[Earlier Summary]` section header는 RAG 스타일 패턴으로 모델이 익숙. Principle 4 (단순·예측가능) 와 부합.
4. CLAUDE.md "real user/assistant turns" 요구사항의 본질적 가치는 **최근 turn들이 진짜 대화 흐름으로 보이는 것**에 있음. 거기에 집중하면 됨.

**Consequences (구현 시)**:
- 변경: `WorkflowContext`에 `Turn` 모델 + `recent_turns` 필드 추가, `to_messages()` 확장, `_call_llm`의 `StepTrace.input`을 slot dict로 확장, ConversationRepository에서 recent_turns를 채우는 로직 추가
- 보존: 현재 `system_prompt + facts + summary`의 단일 system 메시지 concat 패턴 (현재 코드의 가치)
- 발생할 후속 작업: Phase 2에서 "N 초과 turn 요약" chain 구현 시 첫 prompt chaining 사례가 됨 (자연스러운 phase 연결)

**원래 docstring 재해석**:
context.py:12의 `FORBIDDEN: merging multiple slots into a single string without clear section boundaries.`는 처음 ADR-001 논의에서 strict 해석으로 잘못 읽혔으나, *"without section boundaries"* 가 핵심. 현재 코드는 boundary 명시하므로 docstring 준수 중. docstring 변경 불필요.

**개선 필요한 docstring**:
context.py:67 `History is injected as system context, NOT as fake user/assistant turns.` — ADR-001 후 부정확. recent_turns 도입 후 `Recent N turns as real user/assistant messages; older history as compressed summary in system message.` 로 수정 필요.

---

## 6. 헷갈리기 쉬운 함정

- **`notepad.py`** (repo root) — 사용자의 코드 연습용 임시 파일. **절대 commit 금지.** `.gitignore` 미등록 상태이지만 staging 시 명시 경로만 사용할 것.
- **Gemma CoT 마커** — `<|channel>thought ... <channel|>` 형식의 reasoning 토큰. user-facing answer에서는 `strip_reasoning_channel()` 로 제거, 단 **StepTrace.output에는 원본 보존** (CLAUDE.md "LLM Response Post-processing" 참조).
- **Trace flush** — eval server는 flush 시 트레이스를 **삭제하지 않고 보존** (PR #6, commit `3408554`). 메모리 누수처럼 보일 수 있으나 의도된 동작.
- **LLM server는 docker-compose에 없음** — 호스트에서 vllm-mlx로 별도 실행. compose up만 하면 agent가 LLM 연결에 실패함.

---

## 7. 자주 쓰는 명령

```bash
# 전체 기동
docker compose up -d --build

# Agent 로그
docker compose logs -f agent

# 테스트
(cd agent && pytest)
(cd eval && pytest)

# Mongo 직접 확인
docker compose exec mongodb mongosh agent_db
docker compose exec mongodb mongosh eval_db

# Trace 한 건 송출 테스트
curl -X POST localhost:8081/api/chat \
  -H 'content-type: application/json' \
  -d '{"session_id":"test","message":"hello"}'
```

---

_v0.1 · 2026-05-25 · Phase 1.5 완료 시점 핸드오프_
