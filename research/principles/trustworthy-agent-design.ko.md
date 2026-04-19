# 신뢰할 수 있는 에이전트 설계 원칙

> 신뢰할 수 있는 B2B 에이전트를 구축하기 위해 실무 경험과 최신 연구(HTC · AgentHallu · TrajAD · TRACE, 2026)를 기반으로 도출한 원칙입니다.

**버전**: v0.2
**최종 수정일**: 2026.04

---

## 배경 — 프로덕션에서 관찰된 실패 패턴

| 실패 유형 | 근본 원인 | 관련 원칙 |
|-----------|----------|----------|
| 잘못된 도구 선택 | 도구 선택 근거 부재 | 원칙 1 |
| 히스토리 오염 | 불명확한 컨텍스트 경계 | 원칙 2 |
| 낮은 RAG 품질 | 검색 결과 검증 부재 | 원칙 3 |
| 추적 불가능한 단계 | 구조화된 로깅 부재 | 원칙 4 |
| 확신에 찬 오답 | 불확실성 처리 부재 | 원칙 5 |

---

## 원칙 1. 도구 선택은 설명 가능해야 한다

**연구 근거**: AgentHallu (2026) — Tool-Use Hallucination은 탐지가 가장 어렵다. GPT-5조차 정확도 11.6%에 불과하다. 잘못된 도구 선택은 이후 모든 단계를 오염시킨다.

**원칙**: 에이전트는 어떤 도구를 왜 선택했는지 추적할 수 있어야 한다. 선택 근거를 설명할 수 없는 도구 호출은 실행되어서는 안 된다.

```go
func selectTool(query string, tools []Tool) ToolResult {
    scores := rankTools(query, tools)
    best := scores[0]

    if best.Score < ToolConfidenceThreshold {
        return ToolResult{
            Selected:     nil,
            Reason:       "insufficient confidence — user confirmation required",
            Alternatives: scores[:3],
        }
    }

    return ToolResult{
        Selected: &best.Tool,
        Score:    best.Score,
        Reason:   best.Explanation, // selection rationale required
    }
}
```

---

## 원칙 2. 컨텍스트 경계는 명시적으로 설계해야 한다

**연구 근거**: TrajAD (2026) — 에이전트는 과정의 합리성을 무시한 채 목표만 맹목적으로 추구한다. 컨텍스트 오염은 조용히 전파되며, 최종 답변이 생성될 때까지 표면에 드러나지 않는다.

**원칙**: 이전 대화와 현재 요청 간의 경계가 불분명하면 오염이 발생한다. 컨텍스트 범위는 모델에 맡기지 않고 설계 시점에 명시적으로 정의해야 한다.

```go
type WorkflowContext struct {
    // Fixed zone — never modified
    SystemPrompt string      `json:"system_prompt"`
    WorkflowDef  WorkflowDef `json:"workflow_def"`

    // Session zone — verified facts only
    SessionFacts []Fact      `json:"session_facts"`

    // Current turn zone — replaced every step
    CurrentInput   string `json:"current_input"`
    CurrentStepIdx int    `json:"current_step_idx"`

    // History — compressed summary only (original removed)
    HistorySummary string `json:"history_summary"`
}
```

---

## 원칙 3. 검색 품질은 생성 전에 반드시 검증해야 한다

**연구 근거**: DeepHalluBench / PIES Taxonomy (2026) — Retrieval과 Planning hallucination이 전체 실패의 절반 이상을 차지한다. 검색 결과가 부실한 상태에서 생성을 진행하면 hallucination이 계획 단계까지 전파된다.

**원칙**: 부실한 검색 결과로 진행하면 확신에 찬 오답을 만들어 낸다. 검색 품질이 임계값 미만이면 생성을 진행해서는 안 된다.

```go
const MinRelevanceScore = 0.65

func retrieveWithGate(query string, k int) RetrievalResult {
    results := retriever.Search(query, k)
    maxScore := maxRelevance(results)

    if maxScore < MinRelevanceScore {
        return RetrievalResult{
            Docs:    nil,
            Status:  "insufficient",
            Message: "no relevant information found",
        }
    }

    return RetrievalResult{
        Docs:   filterByScore(results, MinRelevanceScore),
        Status: "ok",
    }
}
```

---

## 원칙 4. 모든 단계는 독립적으로 평가 가능해야 한다

**연구 근거**:
- HTC (Salesforce AI, 2026) — 마지막 단계만 보면 중간 실패를 놓친다. 전체 궤적(trajectory)을 진단 피처로 변환해야 한다.
- TRACE (2026) — "고점수 착시(high-score illusion)" 문제: 최종 답변이 맞더라도 추론 과정에 결함이 있을 수 있다.

**원칙**: 최종 답변만 평가하면 어디서 잘못되었는지 알 수 없다. 각 단계의 입력, 출력, 판단을 기록하고 독립적으로 평가할 수 있어야 한다.

```go
type StepTrace struct {
    TraceID   string         `json:"trace_id"`
    StepID    int            `json:"step_id"`
    StepType  StepType       `json:"step_type"`
    IsFirst   bool           `json:"is_first"`
    IsLast    bool           `json:"is_last"`

    Input     map[string]any `json:"input"`
    Output    map[string]any `json:"output"`
    Error     *StepError     `json:"error,omitempty"`

    Confidence float64        `json:"confidence"`
    Reasoning  string         `json:"reasoning"`

    // HTC-based diagnostic signals
    Dynamics  DynamicsSignal  `json:"dynamics"`
    Stability StabilitySignal `json:"stability"`

    Anomaly   *AnomalySignal  `json:"anomaly,omitempty"`

    StartedAt time.Time       `json:"started_at"`
    Duration  time.Duration   `json:"duration"`
}
```

---

## 원칙 5. 불확실할 때는 멈추고 설명하라 — 절대 추측하지 마라

**연구 근거**: HTC 정성적 사례 — 마지막 단계의 confidence가 0.973이었지만 답변은 틀렸다. 전체 궤적을 분석하면 confidence는 0.052였어야 했다.

**원칙**: B2B 신뢰 환경에서는 낮은 confidence로 진행하는 것보다 멈추는 것이 낫다. 실패는 투명하게 표면화해야 하며, 절대 숨겨서는 안 된다.

```go
const (
    ConfidenceThresholdCertain = 0.80
    ConfidenceThresholdHedged  = 0.50
)

func buildResponse(result string, confidence float64, steps []StepTrace) AgentResponse {
    switch {
    case confidence >= ConfidenceThresholdCertain:
        return AgentResponse{Status: StatusConfident, Answer: result}

    case confidence >= ConfidenceThresholdHedged:
        return AgentResponse{
            Status:     StatusHedged,
            Answer:     result,
            Confidence: confidence,
            Caveat:     "this information requires verification",
        }

    default:
        return AgentResponse{
            Status: StatusUncertain,
            Uncertainty: &UncertainInfo{
                Reason:          "insufficient confidence",
                WhatIKnow:       extractPartialInfo(steps),
                SuggestedAction: "recommend expert verification",
            },
        }
    }
}
```

---

## 평가 계층 — 3단계 계층적 진단

### Layer 1. Step-level Eval
각 의사결정 단계를 독립적으로 평가한다.
- 도구 선택의 적절성 (AgentHallu Tool-Use 카테고리)
- 컨텍스트 활용도 (오염 여부 검사)
- 중간 추론 품질 (HTC Dynamics + Position 기반)

### Layer 2. Flow-level Eval
엔드투엔드 흐름의 일관성을 평가한다.
- TrajAD 기반 이상 패턴 탐지
- 흐름이 벗어난 원인 단계를 역추적
- Confidence 추세 분석 ("dropping" 패턴 탐지)

### Layer 3. Output-level Eval
최종 답변의 품질을 평가한다.
- TRACE 기반 고점수 착시 방지 (과정 검증 포함)
- Gold set + LLM-as-judge
- 병렬 휴먼 리뷰
- 회귀 방지 (프롬프트 변경 후 기존 케이스가 유지되는지 검증)

---

## 참고 연구

| 논문 | 기관 | 발표일 | 주요 기여 |
|------|------|--------|----------|
| HTC (Holistic Trajectory Calibration) | Salesforce AI | 2026.01 | 4가지 피처 카테고리로 전체 궤적 진단 |
| AgentHallu | — | 2026.01 | Hallucination을 5가지 카테고리로 분류, 단계별 귀인 |
| TrajAD | — | 2026.02 | 궤적 이상 탐지 |
| TRACE | — | 2026.02 | 고점수 착시 문제, 과정 기반 평가 |
| DeepHalluBench / PIES | — | 2026.01 | RAG + Planning hallucination 분류 체계 |

---

_v0.2 · 2026.04 · 실무 경험 + 최신 연구 기반_
