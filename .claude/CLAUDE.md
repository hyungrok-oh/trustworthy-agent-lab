# CLAUDE.md

This file provides context for Claude Code to understand this project.
Read this before writing any code and apply the principles below to every implementation.

---

## Project Overview

**Purpose**: LLM-based workflow automation agent
**Language**: Go
**LLM**: Qwen-3.5-122B
**Current structure**: No Tool / RAG integration yet. Focused on LLM inference + workflow step execution
**Core goal**: Build an agent enterprise clients can trust — one that says "I don't know" when uncertain, and makes every failure traceable

---

## Design Philosophy (Non-negotiable Principles)

### Principle 1. Every step must be independently traceable
- Evaluating only the final output makes it impossible to know where things went wrong
- Every step's input, output, and decision must be recorded in a structured format
- Never write code that calls LLM without a StepTrace

### Principle 2. When uncertain, stop and explain — never guess
- Do not proceed to the next step with low confidence
- Surface failures transparently, never hide them
- Response format: "I don't know + reason + possible alternative"

### Principle 3. Context boundaries must be explicitly designed
- Never implicitly mix results from previous steps with current input
- Context slots must be explicitly separated at the code level

### Principle 4. Prefer simple, traceable structures over complex abstractions
- Code that can't be debugged can't be trusted
- Minimize logic hidden behind interfaces

---

## Core Types (Must Follow)

### StepTrace — Required for every step

```go
// StepTrace records every execution step of the agent.
// Includes LLM calls, workflow transitions, and decisions.
type StepTrace struct {
    TraceID   string         `json:"trace_id"`   // Full execution unit ID
    StepID    int            `json:"step_id"`    // Sequential number
    StepType  StepType       `json:"step_type"`  // llm_call | workflow | decision | tool_call
    IsFirst   bool           `json:"is_first"`
    IsLast    bool           `json:"is_last"`

    Input     map[string]any `json:"input"`
    Output    map[string]any `json:"output"`
    Error     *StepError     `json:"error,omitempty"`

    // Confidence
    Confidence float64       `json:"confidence"` // 0.0 ~ 1.0
    Reasoning  string        `json:"reasoning"`  // Why was this decision made?

    // Diagnostic signals (based on HTC framework)
    Dynamics  DynamicsSignal  `json:"dynamics"`
    Stability StabilitySignal `json:"stability"`

    // Anomaly detection
    Anomaly   *AnomalySignal `json:"anomaly,omitempty"`

    StartedAt time.Time      `json:"started_at"`
    Duration  time.Duration  `json:"duration"`
}

type StepType string
const (
    StepLLMCall  StepType = "llm_call"
    StepWorkflow StepType = "workflow"
    StepDecision StepType = "decision"
    StepToolCall StepType = "tool_call"
)

type StepError struct {
    Code            string `json:"code"`
    Message         string `json:"message"`
    FailureCategory string `json:"failure_category"`
    // planning | retrieval | reasoning | tool_use | context | output
}

type DynamicsSignal struct {
    ConfidenceDelta float64 `json:"confidence_delta"` // Change vs previous step
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
```

### AgentResponse — Always include confidence

```go
type AgentResponse struct {
    TraceID    string         `json:"trace_id"`
    Status     ResponseStatus `json:"status"`
    Answer     string         `json:"answer,omitempty"`

    // 3-tier confidence
    Confidence  float64       `json:"confidence"`
    Caveat      string        `json:"caveat,omitempty"`
    Uncertainty *UncertainInfo `json:"uncertainty,omitempty"`

    Steps []StepTrace `json:"steps"` // Full trace path
}

type ResponseStatus string
const (
    StatusConfident ResponseStatus = "confident"
    StatusHedged    ResponseStatus = "hedged"
    StatusUncertain ResponseStatus = "uncertain"
)

type UncertainInfo struct {
    Reason          string `json:"reason"`
    WhatIKnow       string `json:"what_i_know"`
    SuggestedAction string `json:"suggested_action"`
}
```

---

## Coding Rules

### LLM Calls — Always wrap with StepTrace

```go
// Correct pattern
func (a *Agent) callLLM(ctx context.Context, trace *TraceContext, prompt string) (string, error) {
    step := StepTrace{
        TraceID:   trace.ID,
        StepID:    trace.NextStepID(),
        StepType:  StepLLMCall,
        Input:     map[string]any{"prompt": prompt},
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

    step.Output     = map[string]any{"response": resp.Text}
    step.Confidence = resp.Confidence
    step.Reasoning  = resp.Reasoning
    trace.AddStep(step)
    return resp.Text, nil
}

// Forbidden pattern — never do this
// resp, err := a.llm.Complete(ctx, prompt) // direct call without trace
```

### Workflow Transitions — Always record reason

```go
func (a *Agent) transition(trace *TraceContext, from, to WorkflowState, reason string) {
    step := StepTrace{
        TraceID:   trace.ID,
        StepID:    trace.NextStepID(),
        StepType:  StepDecision,
        Input:     map[string]any{"from_state": from},
        Output:    map[string]any{"to_state": to},
        Reasoning: reason, // Always record why
    }
    trace.AddStep(step)
}
```

### Error Handling — Classify failure by category

```go
// Error categories (based on AgentHallu taxonomy)
const (
    ErrCategoryPlanning  = "planning"   // Goal interpretation failure
    ErrCategoryReasoning = "reasoning"  // Reasoning error
    ErrCategoryContext   = "context"    // Context contamination
    ErrCategoryOutput    = "output"     // Output generation failure
)
```

---

## Context Management Rules

```go
// Context slots must always be separated
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

    // Strictly forbidden: merging multiple slots into a single string
}
```

---

## Confidence Thresholds

```go
const (
    ConfidenceThresholdCertain = 0.80 // Confident → proceed
    ConfidenceThresholdHedged  = 0.50 // Needs caution → proceed with warning
    // Below 0.50 → stop and return UncertainInfo
)
```

---

## Rules for Future Extensions

### When adding Tool integration
- All tool calls must be recorded with `StepType = "tool_call"`
- Tool selection reasoning must be included in StepTrace
- Tool failures must be categorized as `ErrCategoryPlanning` or a new `ErrCategoryTool`

### When adding RAG integration
- Retrieval relevance scores must be recorded in StepTrace
- Do not proceed to generation if score is below threshold
- Log retrieval failures and generation failures separately

---

## What NOT To Do

- Debugging with `fmt.Println` only → record with StepTrace
- Using LLM response directly as next step input → validate first
- Handling errors with `log.Fatal` → structure as StepError and propagate
- Merging multiple step results into one string → keep slots separated
- Adding new features without StepTrace

---

## Reference Research

- HTC (Salesforce AI, 2026): Trajectory-level Confidence Calibration
- AgentHallu (2026): Hallucination Attribution by Step Category
- TrajAD (2026): Trajectory Anomaly Detection
- TRACE (2026): Beyond Final-Output Evaluation

---

_v0.1 · 2026.04 · Based on hands-on experience + latest research_
