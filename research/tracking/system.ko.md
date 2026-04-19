# 개인 트래킹 시스템

> 트렌드에 휩쓸리지 않고, 신뢰할 수 있는 에이전트 전문가로 성장하기 위한 지속 가능한 학습 루틴.

---

## 설계 원칙

**"수집은 자동화하고, 판단은 항상 직접 한다."**

유지하기 너무 복잡한 트래킹 시스템은 쓸모없다.
현실적으로 투입할 수 있는 시간에 맞춰 설계한다.

---

## 2계층 구조

### Core 계층 — 절대 빠뜨리지 않는다 (주 30분)
바쁠 때도, 피곤할 때도 이것만은 한다. 이게 무너지면 시스템 전체가 무너진다.

### Extended 계층 — 여유가 있을 때
빠뜨려도 괜찮다. Core만 살아 있으면 시스템은 살아 있다.

---

## 주간 리듬

| 요일 | 계층 | 시간 | 내용 |
|------|------|------|------|
| 월요일 | Core | 5분 | 트리거 포착 |
| 수요일 | Core | 5분 | 주중 점검 |
| 금요일 | Core | 20분 | 주간 리뷰 + 레이더 업데이트 |
| 토요일 | Extended | 2–3시간 | 딥 워크 — 직접 만들어 보기 |
| 일요일 | Extended | 1–2시간 | 정리 + 월간 회고 (월 1회) |

---

## Core 계층 상세

### 월요일 — 트리거 포착 (5분)

이번 주 눈에 띈 것 하나만 기록한다.

```
Sources:
- GitHub Watch (changes in repos you follow)
- RSS arXiv cs.AI
- Problems encountered at work
- Conversations with teammates

Format:
- Title + one-line note
- No need to write much
- One item only (collecting more = doing nothing)
```

**노트 템플릿**:
```
Date: YYYY-MM-DD
Trigger: [title]
One-line note: [why did this catch your attention]
```

### 수요일 — 주중 점검 (5분)

월요일의 트리거를 3가지 질문 판단 필터에 통과시킨다.

```
Check:
✓ Does it solve a trust problem?
✓ Are people using it in production?
✓ Will it still be relevant in 6 months?

Result:
→ 2 or more Yes → carry forward to Friday review
→ Otherwise → discard (discarding is also an important decision)
```

### 금요일 — 주간 리뷰 (20분)

트리거를 기술 레이더에 배치하고 notes/에 커밋한다.

```
20-minute breakdown:
- 5 min: Final trigger review
- 10 min: Radar placement decision (Adopt/Trial/Assess/Hold)
- 5 min: Write notes/YYYY-MM-wN.md + commit

Placement criteria:
Adopt  → Use now, validated
Trial  → Currently experimenting, no conclusion yet
Assess → Watching, reassess in 6 months
Hold   → Not now, record reason
```

---

## Extended 계층 상세

### 토요일 — 딥 워크 (2–3시간)

이번 주 가장 흥미로운 것을 골라서 코드로 구현한다.

```
Goal: Not completion — "actually getting your hands dirty"

Implementation pattern:
1. Extract one core concept from paper/idea
2. Minimal implementation in Go (50–100 lines)
3. Connect it to the actual workflow agent
4. Record: "Did it work? Why / why not?"

Examples:
- Implement StepTrace structure from HTC
- Build a failure classifier for AgentHallu's 5 categories
- Implement confidence-threshold-based response branching
```

### 일요일 — 정리 (1–2시간)

토요일 결과를 문서화하고, 한 달에 한 번 월간 회고를 진행한다.

```
Every week:
- Write up implementation results in notes/
- Update CLAUDE.md if needed

Once a month (last Sunday):
- Did I actually use what I put in Adopt this month?
- Do the design principles need revision?
- Readjust the tech radar
- Choose 1 focus area for next month
```

---

## 정보 소스

### Primary — 원본 소스
```
- Anthropic blog / release notes
- arXiv cs.AI (keywords: Agent, Eval, Reliability)
- GitHub: Claude Code, OpenClaw, llm-d, vLLM
- Key people on X/Twitter
```

### Secondary — 큐레이션된 소스
```
- TLDR AI (newsletter)
- The Batch (Andrew Ng)
- Latent Space podcast
```

### 줄여야 할 소스
```
- LinkedIn AI posts (high noise ratio)
- "X is changing AI forever" media
- Framework official blogs (marketing bias)
```

---

## 도구

| 도구 | 용도 |
|------|------|
| GitHub (this repo) | 기술 레이더 + 주간 노트 |
| GitHub Watch | 관심 저장소 변경 알림 |
| RSS + arXiv | 논문 자동 알림 |
| Obsidian (선택) | 로컬 초안 작성 |

---

## 이 시스템을 무너뜨리는 패턴

```
✗ Collecting more than one trigger
  → One only. More = doing nothing

✗ Reading without taking notes
  → Always convert to a one-line note. No note = no trigger.

✗ Skipping Extended because you missed Core
  → As long as Core is alive, the system is alive

✗ Tracking without a judgment standard
  → Always filter through Core Beliefs and judgment filter
  → No standard = only noise accumulates

✗ Spending energy deciding on a blog platform
  → Decide when you have 10+ pieces of content
```

---

## 예상 성과

```
1 month  → Core routine established. Tech radar v0.2 updated.
3 months → 12+ validated technologies/concepts accumulated.
           Design principles v0.3 revised.
6 months → Eval layer implemented in Go agent.
           Team sharing begins (GitHub link).
1 year   → On-device agent exploration begins.
           Blog / public sharing considered.
```

---

## 주간 노트 템플릿

`notes/YYYY-MM-wN.md`로 저장

```markdown
# YYYY Week N (Month)

## Trigger
- [Title]: [one-line note]

## Judgment Filter Result
- Solves a trust problem: Y/N
- Production usage: Y/N
- Relevant in 6 months: Y/N
- Decision: Adopt / Trial / Assess / Hold / Discard

## This Week's Build
- What I built:
- Did it work:
- Why / why not:

## Continue Next Week
- [one thing]
```

---

_v0.1 · 2026.04 · 개인 리듬에 맞춰 설계 (평일 9–6 + 저녁/주말)_
