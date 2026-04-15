# Trustworthy Agent Design Principles

> Derived from hands-on experience + latest research (HTC · AgentHallu · TrajAD · TRACE, 2026) for building trustworthy B2B agents.

**Version**: v0.2
**Last updated**: 2026.04

---

## Background — Failure Patterns from Production

| Failure Type | Root Cause | Linked Principle |
|--------------|------------|-----------------|
| Wrong tool selection | No basis for tool choice | Principle 1 |
| History contamination | Unclear context boundaries | Principle 2 |
| Poor RAG quality | No retrieval validation | Principle 3 |
| Untraceable steps | No structured logging | Principle 4 |
| Confident wrong answers | No uncertainty handling | Principle 5 |

---

## Principle 1. Tool selection must be explainable

**Research basis**: AgentHallu (2026) — Tool-Use Hallucination is the hardest to detect. Even GPT-5 achieves only 11.6% accuracy. A wrong tool selection contaminates every subsequent step.

**Principle**: The agent must be able to trace which tool it selected and why. A tool call whose selection cannot be explained must not be executed.

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

## Principle 2. Context boundaries must be explicitly designed

**Research basis**: TrajAD (2026) — Agents blindly pursue goals while ignoring process rationality. Context contamination spreads silently — it doesn't surface until the final answer is generated.

**Principle**: Unclear boundaries between previous conversation and current request cause contamination. Context scope must be explicitly defined at design time, not left to the model.

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

## Principle 3. Retrieval quality must be validated before generation

**Research basis**: DeepHalluBench / PIES Taxonomy (2026) — Retrieval and Planning hallucinations account for over half of all failures. Proceeding to generation with poor retrieval results propagates hallucinations into the planning stage.

**Principle**: Proceeding with poor retrieval results produces confident wrong answers. If retrieval quality falls below threshold, generation must not proceed.

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

## Principle 4. Every step must be independently evaluable

**Research basis**:
- HTC (Salesforce AI, 2026) — Looking only at the last step misses intermediate failures. The entire trajectory must be converted into diagnostic features.
- TRACE (2026) — The "high-score illusion": even when the final answer is correct, the reasoning process may be flawed.

**Principle**: Evaluating only the final answer makes it impossible to know where things went wrong. Each step's input, output, and decision must be recorded and independently evaluable.

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

## Principle 5. When uncertain, stop and explain — never guess

**Research basis**: HTC qualitative example — last step confidence was 0.973 but the answer was wrong. Looking at the full trajectory, the confidence should have been 0.052.

**Principle**: Stopping is better than proceeding with low confidence in B2B trust. Failures must be surfaced transparently, never hidden.

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

## Evaluation Layers — 3-tier hierarchical diagnosis

### Layer 1. Step-level Eval
Independent evaluation of each decision step.
- Tool selection appropriateness (AgentHallu Tool-Use category)
- Context utilization (contamination check)
- Intermediate reasoning quality (HTC Dynamics + Position based)

### Layer 2. Flow-level Eval
End-to-end flow consistency evaluation.
- Anomaly pattern detection based on TrajAD
- Backtracing which step caused the flow to diverge
- Confidence trend analysis (detecting "dropping" patterns)

### Layer 3. Output-level Eval
Final answer quality evaluation.
- High-score illusion prevention based on TRACE (includes process validation)
- Gold set + LLM-as-judge
- Human review in parallel
- Regression prevention (verify existing cases hold after prompt changes)

---

## Reference Research

| Paper | Organization | Date | Key Contribution |
|-------|-------------|------|-----------------|
| HTC (Holistic Trajectory Calibration) | Salesforce AI | 2026.01 | Diagnose entire trajectory with 4 feature categories |
| AgentHallu | — | 2026.01 | Classify hallucinations into 5 categories, step attribution |
| TrajAD | — | 2026.02 | Trajectory anomaly detection |
| TRACE | — | 2026.02 | High-score illusion problem, process-based evaluation |
| DeepHalluBench / PIES | — | 2026.01 | RAG + Planning hallucination taxonomy |

---

_v0.2 · 2026.04 · Based on hands-on experience + latest research_
