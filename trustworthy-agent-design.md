# 신뢰 가능한 Agent 설계 원칙

> 실무 경험 + 최신 연구(HTC · AgentHallu · TrajAD · TRACE, 2026)를 기반으로 도출한 B2B Agent 설계 원칙입니다.

**버전**: v0.2  
**최종 업데이트**: 2026.04

---

## 배경 — 실무에서 겪은 실패 패턴

| 실패 유형 | 원인 | 연결 원칙 |
|-----------|------|-----------|
| 잘못된 Tool 선택 | Tool 선택 근거 없음 | 원칙 1 |
| History 오염 | Context 경계 불명확 | 원칙 2 |
| RAG 품질 저하 | 검색 결과 검증 없음 | 원칙 3 |
| Step 추적 불가 | 구조화 로그 부재 | 원칙 4 |
| 자신있는 오답 | 불확실성 처리 없음 | 원칙 5 |

---

## 원칙 1. Tool 선택은 설명 가능해야 한다

**연구 근거**: AgentHallu (2026) — Tool-Use Hallucination이 가장 탐지하기 어려움. GPT-5도 11.6% 정확도. 잘못된 Tool 선택은 이후 모든 Step을 오염시킨다.

**원칙**: Agent가 어떤 Tool을 왜 선택했는지 추적 가능해야 한다. 선택 근거를 설명할 수 없는 Tool 호출은 실행되면 안 된다.

```go
// Tool 선택 전 confidence 측정
func selectTool(query string, tools []Tool) ToolResult {
    scores := rankTools(query, tools)
    best := scores[0]

    if best.Score < ToolConfidenceThreshold {
        return ToolResult{
            Selected: nil,
            Reason:   "확신 부족 — 사용자 확인 필요",
            Alternatives: scores[:3],
        }
    }

    return ToolResult{
        Selected: &best.Tool,
        Score:    best.Score,
        Reason:   best.Explanation, // 선택 근거 필수
    }
}

// Step 로그에 반드시 기록
stepLog := StepTrace{
    StepType:  StepToolCall,
    Input:     map[string]any{"query": query},
    Output:    map[string]any{"tool": toolName},
    Reasoning: explanation, // 왜 이 Tool을 선택했는가
    Confidence: score,
}
```

---

## 원칙 2. Context 경계는 명시적으로 설계한다

**연구 근거**: TrajAD (2026) — Agent는 맹목적으로 목표를 향해 달리며 프로세스 합리성을 무시한다. Context 오염은 조용히 퍼진다 — 최종 답변이 나올 때까지 드러나지 않는다.

**원칙**: 이전 대화와 현재 요청의 경계가 불명확하면 오염이 발생한다. Context 범위는 모델에 맡기지 않고 설계 단계에서 명시적으로 정의한다.

```go
// Context 슬롯은 반드시 분리한다
type WorkflowContext struct {
    // 고정 영역 — 절대 수정하지 않음
    SystemPrompt string      `json:"system_prompt"`
    WorkflowDef  WorkflowDef `json:"workflow_def"`

    // 세션 영역 — 검증된 사실만
    SessionFacts []Fact      `json:"session_facts"`

    // 현재 턴 영역 — 매 Step마다 교체
    CurrentInput   string `json:"current_input"`
    CurrentStepIdx int    `json:"current_step_idx"`

    // 이력 — 압축 요약본만 유지 (원본 제거)
    HistorySummary string `json:"history_summary"`

    // 절대 금지: 여러 슬롯을 하나의 string으로 합치기
}

// Context 오염 탐지
func validateContext(ctx *WorkflowContext) error {
    conflicts := detectConflicts(
        ctx.SessionFacts,
        ctx.CurrentInput,
    )
    if len(conflicts) > 0 {
        logAnomaly("context_conflict", conflicts)
        return ErrContextConflict
    }
    return nil
}
```

---

## 원칙 3. 검색 품질은 생성 전에 검증한다

**연구 근거**: DeepHalluBench / PIES Taxonomy (2026) — Retrieval Hallucination과 Planning Hallucination이 전체의 절반 이상. 나쁜 검색 결과로 생성을 진행하면 Hallucination이 Planning 단계로 전파된다.

**원칙**: RAG에서 나쁜 검색 결과로 생성을 진행하면 자신감 있는 오답이 나온다. 검색 결과의 품질이 기준에 미달하면 생성 자체를 하지 않는다.

```go
const MinRelevanceScore = 0.65

type RetrievalResult struct {
    Docs    []Document `json:"docs"`
    Status  string     `json:"status"` // "ok" | "insufficient"
    Message string     `json:"message,omitempty"`
}

func retrieveWithGate(query string, k int) RetrievalResult {
    results := retriever.Search(query, k)

    maxScore := maxRelevance(results)
    if maxScore < MinRelevanceScore {
        // 검색 실패 → 생성하지 않음
        return RetrievalResult{
            Docs:    nil,
            Status:  "insufficient",
            Message: "관련 정보를 찾지 못했습니다",
        }
    }

    // threshold 이상만 통과
    return RetrievalResult{
        Docs:   filterByScore(results, MinRelevanceScore),
        Status: "ok",
    }
}
```

---

## 원칙 4. 모든 Step은 독립적으로 평가 가능해야 한다

**연구 근거**:
- HTC (Salesforce AI, 2026) — 마지막 Step만 보면 중간 실패를 감지 못한다. Trajectory 전체를 Feature로 변환해야 한다.
- TRACE (2026) — "고득점 환상": 최종 답이 맞아도 추론 과정이 틀렸을 수 있다.

**원칙**: 최종 답변만 평가하면 어디서 잘못됐는지 알 수 없다. 각 Step의 입력·출력·의사결정이 독립적으로 기록되고 평가될 수 있어야 한다.

```go
// StepTrace — 모든 실행 단계에 필수
type StepTrace struct {
    TraceID  string   `json:"trace_id"`  // 전체 실행 단위 ID
    StepID   int      `json:"step_id"`   // 순번
    StepType StepType `json:"step_type"` // llm_call | workflow | decision | tool_call
    IsFirst  bool     `json:"is_first"`
    IsLast   bool     `json:"is_last"`

    Input  map[string]any `json:"input"`
    Output map[string]any `json:"output"`
    Error  *StepError     `json:"error,omitempty"`

    // 신뢰도 관련 (HTC 기반)
    Confidence float64 `json:"confidence"` // 0.0 ~ 1.0
    Reasoning  string  `json:"reasoning"`  // 왜 이 결정을 했는가

    // HTC 4가지 카테고리 기반 진단 신호
    Dynamics  DynamicsSignal  `json:"dynamics"`
    Stability StabilitySignal `json:"stability"`

    // 이상 감지
    Anomaly *AnomalySignal `json:"anomaly,omitempty"`

    StartedAt time.Time     `json:"started_at"`
    Duration  time.Duration `json:"duration"`
}

type DynamicsSignal struct {
    ConfidenceDelta float64 `json:"confidence_delta"` // 이전 Step 대비
    Trend           string  `json:"trend"`             // increasing | stable | dropping
}

type StabilitySignal struct {
    OutputConsistency float64 `json:"output_consistency"`
}

type AnomalySignal struct {
    Type        string `json:"type"`
    Severity    string `json:"severity"` // low | medium | high
    Description string `json:"description"`
}

// 에러 카테고리 (AgentHallu 분류 기반)
type StepError struct {
    Code             string `json:"code"`
    Message          string `json:"message"`
    FailureCategory  string `json:"failure_category"`
    // planning | retrieval | reasoning | tool_use | context | output
}
```

---

## 원칙 5. 불확실하면 멈추고 설명한다, 추측하지 않는다

**연구 근거**: HTC 정성 예시 — 마지막 Step confidence 0.973이었는데 실제로 틀림. Trajectory 전체를 보면 confidence는 0.052였어야 함.

**원칙**: 낮은 확신으로 계속 진행하는 것보다 멈추는 것이 B2B 신뢰를 더 지킨다. 실패는 숨기지 않고 투명하게 드러낸다.

```go
const (
    ConfidenceThresholdCertain = 0.80 // 확신 있음 → 진행
    ConfidenceThresholdHedged  = 0.50 // 주의 필요 → 경고와 함께 진행
    // 0.50 미만 → 중단 후 UncertainInfo 반환
)

type AgentResponse struct {
    TraceID    string         `json:"trace_id"`
    Status     ResponseStatus `json:"status"`
    Answer     string         `json:"answer,omitempty"`
    Confidence float64        `json:"confidence"`

    // 불확실할 때 반드시 채움
    Caveat      string        `json:"caveat,omitempty"`
    Uncertainty *UncertainInfo `json:"uncertainty,omitempty"`

    Steps []StepTrace `json:"steps"` // 전체 추적 경로
}

type UncertainInfo struct {
    Reason          string `json:"reason"`
    WhatIKnow       string `json:"what_i_know"`
    SuggestedAction string `json:"suggested_action"`
}

func buildResponse(result string, confidence float64, steps []StepTrace) AgentResponse {
    switch {
    case confidence >= ConfidenceThresholdCertain:
        return AgentResponse{Status: StatusConfident, Answer: result}

    case confidence >= ConfidenceThresholdHedged:
        return AgentResponse{
            Status:     StatusHedged,
            Answer:     result,
            Confidence: confidence,
            Caveat:     "확인이 필요한 정보입니다",
        }

    default:
        return AgentResponse{
            Status: StatusUncertain,
            Uncertainty: &UncertainInfo{
                Reason:          "확신 부족",
                WhatIKnow:       extractPartialInfo(steps),
                SuggestedAction: "담당자 확인 권장",
            },
        }
    }
}
```

---

## 평가 레이어 — 3단계 계층적 진단

### Layer 1. Step-level Eval
각 의사결정 단계 독립 평가.

```
평가 항목:
- Tool 선택 적절성 (AgentHallu Tool-Use 카테고리)
- Context 활용도 (오염 여부)
- 중간 추론 품질 (HTC Dynamics + Position 기반)
```

### Layer 2. Flow-level Eval
전체 흐름 일관성 평가.

```
평가 항목:
- TrajAD 기반 이상 패턴 탐지
- 어느 Step에서 방향이 틀어졌는지 역추적
- Confidence Trend 분석 (dropping 패턴 감지)
```

### Layer 3. Output-level Eval
최종 답변 품질 평가.

```
평가 항목:
- TRACE의 고득점 환상 방지 (과정 검증 포함)
- Gold set 기반 LLM-as-judge
- 인간 검토 병행
- 회귀 방지 (프롬프트 변경 시 기존 케이스 유지 여부)
```

---

## 참고 연구

| 논문 | 기관 | 날짜 | 핵심 기여 |
|------|------|------|-----------|
| HTC (Holistic Trajectory Calibration) | Salesforce AI | 2026.01 | Trajectory 전체를 4개 Feature로 진단 |
| AgentHallu | - | 2026.01 | Hallucination을 5개 카테고리로 분류, Step 귀인 |
| TrajAD | - | 2026.02 | Trajectory 이상 탐지 |
| TRACE | - | 2026.02 | 고득점 환상 문제 제기, 과정 기반 평가 |
| DeepHalluBench / PIES | - | 2026.01 | RAG + Planning Hallucination 분류 체계 |

---

_v0.2 · 2026.04 · 실무 경험 + 최신 연구 기반_
