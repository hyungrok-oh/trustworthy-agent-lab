# CLAUDE.md

이 파일은 Claude Code가 이 프로젝트를 이해하기 위한 컨텍스트입니다.
코드 작성 전 반드시 읽고, 아래 원칙을 모든 구현에 반영하세요.

---

## 프로젝트 개요

**목적**: LLM 기반 워크플로우 자동화 Agent  
**언어**: Go  
**LLM**: Qwen-3.5-122B  
**현재 구조**: Tool / RAG 미연동. LLM 추론 + 워크플로우 Step 실행 중심  
**핵심 목표**: 기업 고객이 신뢰할 수 있는 Agent — 모르면 모른다고 말하고, 실패 지점을 추적할 수 있어야 한다

---

## 설계 철학 (절대 원칙)

### 원칙 1. 모든 Step은 독립적으로 추적 가능해야 한다
- 최종 출력만 평가하면 어디서 잘못됐는지 알 수 없다
- 각 Step의 입력 · 출력 · 의사결정은 반드시 구조화된 형태로 기록한다
- Step 로그 없이 LLM을 호출하는 코드를 작성하지 않는다

### 원칙 2. 불확실하면 멈추고 설명한다, 추측하지 않는다
- 낮은 확신으로 다음 Step을 진행하지 않는다
- 실패는 숨기지 않고 투명하게 드러낸다
- 응답 형태: "모르겠습니다 + 이유 + 가능한 대안"

### 원칙 3. Context 경계는 명시적으로 설계한다
- 이전 Step의 결과와 현재 입력을 암묵적으로 섞지 않는다
- Context 슬롯은 코드 레벨에서 명시적으로 분리한다

### 원칙 4. 복잡한 추상화보다 단순하고 추적 가능한 구조를 선호한다
- 디버깅할 수 없는 코드는 신뢰할 수 없다
- 인터페이스 뒤에 숨겨진 로직은 최소화한다

---

## 핵심 타입 (반드시 준수)

### StepTrace — 모든 Step에 필수

```go
// StepTrace는 Agent의 모든 실행 단계를 기록한다.
// LLM 호출, 워크플로우 전환, 의사결정 모두 포함.
type StepTrace struct {
    TraceID    string          `json:"trace_id"`    // 전체 실행 단위 ID
    StepID     int             `json:"step_id"`     // 순번
    StepType   StepType        `json:"step_type"`   // llm_call | workflow | decision
    IsFirst    bool            `json:"is_first"`
    IsLast     bool            `json:"is_last"`

    Input      map[string]any  `json:"input"`
    Output     map[string]any  `json:"output"`
    Error      *StepError      `json:"error,omitempty"`

    // 신뢰도 관련
    Confidence float64         `json:"confidence"`  // 0.0 ~ 1.0
    Reasoning  string          `json:"reasoning"`   // 왜 이 결정을 했는가

    // 이상 감지
    Anomaly    *AnomalySignal  `json:"anomaly,omitempty"`

    StartedAt  time.Time       `json:"started_at"`
    Duration   time.Duration   `json:"duration"`
}

type StepType string
const (
    StepLLMCall    StepType = "llm_call"
    StepWorkflow   StepType = "workflow"
    StepDecision   StepType = "decision"
)

type StepError struct {
    Code    string `json:"code"`
    Message string `json:"message"`
    // 중요: 어느 단계에서 발생했는지 명시
    FailureCategory string `json:"failure_category"` 
    // planning | reasoning | context | output
}

type AnomalySignal struct {
    Type        string  `json:"type"`
    Severity    string  `json:"severity"` // low | medium | high
    Description string  `json:"description"`
}
```

### AgentResponse — 응답은 항상 신뢰도를 포함

```go
type AgentResponse struct {
    TraceID    string          `json:"trace_id"`
    Status     ResponseStatus  `json:"status"`
    Answer     string          `json:"answer,omitempty"`

    // 신뢰도 3단계
    Confidence  float64        `json:"confidence"`
    Caveat      string         `json:"caveat,omitempty"`  // 주의사항
    Uncertainty *UncertainInfo `json:"uncertainty,omitempty"`

    Steps      []StepTrace     `json:"steps"`  // 전체 추적 경로
}

type ResponseStatus string
const (
    StatusConfident    ResponseStatus = "confident"    // 확신 있음
    StatusHedged       ResponseStatus = "hedged"       // 확신 부족, 주의 필요
    StatusUncertain    ResponseStatus = "uncertain"    // 모름, 중단
)

type UncertainInfo struct {
    Reason          string   `json:"reason"`
    WhatIKnow       string   `json:"what_i_know"`
    SuggestedAction string   `json:"suggested_action"`
}
```

---

## 코드 작성 규칙

### LLM 호출 — 반드시 StepTrace로 감싸기

```go
// 올바른 패턴
func (a *Agent) callLLM(ctx context.Context, trace *TraceContext, prompt string) (string, error) {
    step := StepTrace{
        TraceID:  trace.ID,
        StepID:   trace.NextStepID(),
        StepType: StepLLMCall,
        Input:    map[string]any{"prompt": prompt},
        StartedAt: time.Now(),
    }

    resp, err := a.llm.Complete(ctx, prompt)
    step.Duration = time.Since(step.StartedAt)

    if err != nil {
        step.Error = &StepError{
            Code:            "llm_failure",
            Message:         err.Error(),
            FailureCategory: "reasoning",
        }
        trace.AddStep(step)
        return "", err
    }

    step.Output = map[string]any{"response": resp.Text}
    step.Confidence = resp.Confidence  // Qwen이 제공하는 경우
    step.Reasoning = resp.Reasoning
    trace.AddStep(step)

    return resp.Text, nil
}

// 잘못된 패턴 — 절대 사용 금지
// resp, err := a.llm.Complete(ctx, prompt) // 추적 없이 직접 호출
```

### 워크플로우 전환 — 전환 근거 명시

```go
func (a *Agent) transition(trace *TraceContext, from, to WorkflowState, reason string) {
    step := StepTrace{
        TraceID:    trace.ID,
        StepID:     trace.NextStepID(),
        StepType:   StepDecision,
        Input:      map[string]any{"from_state": from},
        Output:     map[string]any{"to_state": to},
        Reasoning:  reason,  // 왜 전환했는지 반드시 기록
    }
    trace.AddStep(step)
}
```

### 에러 처리 — 실패 지점을 카테고리로 분류

```go
// 에러 카테고리 상수 (AgentHallu 분류 기반)
const (
    ErrCategoryPlanning   = "planning"    // 목표 해석 실패
    ErrCategoryReasoning  = "reasoning"   // 추론 오류
    ErrCategoryContext    = "context"     // 컨텍스트 오염
    ErrCategoryOutput     = "output"      // 출력 생성 실패
)
```

---

## Context 관리 규칙

```go
// Context 슬롯은 반드시 분리한다
type WorkflowContext struct {
    // 고정 영역 — 절대 수정하지 않음
    SystemPrompt   string         `json:"system_prompt"`
    WorkflowDef    WorkflowDef    `json:"workflow_def"`

    // 세션 영역 — 검증된 사실만
    SessionFacts   []Fact         `json:"session_facts"`

    // 현재 턴 영역 — 매 Step마다 교체
    CurrentInput   string         `json:"current_input"`
    CurrentStepIdx int            `json:"current_step_idx"`

    // 이력 — 압축 요약본만 유지
    HistorySummary string         `json:"history_summary"`

    // 절대 금지: 여러 슬롯을 하나의 string으로 합치기
}
```

---

## 신뢰도 임계값

```go
const (
    ConfidenceThresholdCertain  = 0.80  // 확신 있음 → 진행
    ConfidenceThresholdHedged   = 0.50  // 주의 필요 → 경고와 함께 진행
    // 0.50 미만 → 중단 후 UncertainInfo 반환
)

func classifyConfidence(score float64) ResponseStatus {
    switch {
    case score >= ConfidenceThresholdCertain:
        return StatusConfident
    case score >= ConfidenceThresholdHedged:
        return StatusHedged
    default:
        return StatusUncertain
    }
}
```

---

## 앞으로 추가될 때 지켜야 할 것

### Tool 연동 시
- 모든 Tool 호출은 `StepType = "tool_call"`로 기록
- Tool 선택 근거(Reasoning)를 StepTrace에 반드시 포함
- Tool 실패는 `ErrCategoryPlanning` 또는 별도 `ErrCategoryTool`로 분류

### RAG 연동 시
- 검색 결과 relevance score를 StepTrace에 기록
- score 임계값 미달 시 생성 단계로 진행하지 않음
- 검색 실패와 생성 실패를 분리하여 로깅

---

## 하지 말아야 할 것

- `fmt.Println`으로 디버그하고 끝내기 → StepTrace로 기록할 것
- LLM 응답을 즉시 다음 Step 입력으로 사용 → 검증 후 사용
- 에러를 `log.Fatal`로 처리 → StepError로 구조화 후 상위에 전파
- 여러 Step 결과를 하나의 string으로 합산 → 슬롯 분리 유지
- StepTrace 없이 새 기능 추가

---

## 참고 연구

- HTC (Salesforce AI, 2026): Trajectory-level Confidence Calibration
- AgentHallu (2026): Hallucination Attribution by Step Category  
- TrajAD (2026): Trajectory Anomaly Detection
- TRACE (2026): Beyond Final-Output Evaluation

---

_v0.1 · 2026.04 · 실무 경험 + 최신 연구 기반_
