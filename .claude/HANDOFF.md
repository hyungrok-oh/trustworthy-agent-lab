# HANDOFF.md
# Context for Claude Code — Continue from Claude.ai conversation

> This file summarizes the full context from a prior Claude.ai conversation.
> Read this first before doing anything else.
> Delete this file once the session is established.

---

## Who I Am

- **Name**: Hyungrok Oh
- **Role**: AI Agent Engineer
- **Focus**: Designing and evaluating trustworthy LLM agent systems in B2B environments
- **Mission**: Build agents that say "I don't know" when uncertain, and make every failure traceable

---

## Current Project Stack

- **Language**: Go
- **LLM**: Qwen-3.5-122B
- **Domain**: Workflow automation agent (B2B)
- **Tool / RAG**: Not yet integrated
- **Claude Code context**: `.claude/CLAUDE.md` exists in this repo

---

## What We Did in the Previous Session

We spent a full session building the foundation of a personal research system:

1. Defined a **mission and core beliefs** around trustworthy agent design
2. Derived **5 design principles** from real production failure patterns + latest research (HTC, AgentHallu, TrajAD, TRACE — all 2026)
3. Wrote `CLAUDE.md` with Go-specific coding rules and required types
4. Designed a **personal tracking system** (weekly rhythm, tech radar)
5. Published everything to GitHub: `hyungrok-oh/trustworthy-agent-lab`

---

## What We Want to Do Next

**Build an Agent Evaluation System.**

The core pain point:
> "When my agent produces a wrong answer, I have no idea which step caused it.
> I want step-level traceability — not just input → output evaluation."

The goal:
1. Look at the current Go project structure together
2. Add `StepTrace` logging to existing LLM calls (smallest possible starting point)
3. Define the first eval metric (step success/failure)
4. Gradually build toward 3-layer evaluation:
   - Step-level (per decision)
   - Flow-level (anomaly detection across steps)
   - Output-level (LLM-as-judge on final answer)

---

## Key Types Already Designed

These are in `.claude/CLAUDE.md`. Implement these, don't redesign them.

```go
type StepTrace struct {
    TraceID    string         `json:"trace_id"`
    StepID     int            `json:"step_id"`
    StepType   StepType       `json:"step_type"` // llm_call | workflow | decision | tool_call
    IsFirst    bool           `json:"is_first"`
    IsLast     bool           `json:"is_last"`
    Input      map[string]any `json:"input"`
    Output     map[string]any `json:"output"`
    Error      *StepError     `json:"error,omitempty"`
    Confidence float64        `json:"confidence"`
    Reasoning  string         `json:"reasoning"`
    Dynamics   DynamicsSignal  `json:"dynamics"`
    Stability  StabilitySignal `json:"stability"`
    Anomaly    *AnomalySignal `json:"anomaly,omitempty"`
    StartedAt  time.Time      `json:"started_at"`
    Duration   time.Duration  `json:"duration"`
}

type AgentResponse struct {
    TraceID     string         `json:"trace_id"`
    Status      ResponseStatus `json:"status"`      // confident | hedged | uncertain
    Answer      string         `json:"answer,omitempty"`
    Confidence  float64        `json:"confidence"`
    Caveat      string         `json:"caveat,omitempty"`
    Uncertainty *UncertainInfo `json:"uncertainty,omitempty"`
    Steps       []StepTrace    `json:"steps"`
}
```

---

## Design Principles (Non-negotiable)

1. Every step must be independently traceable — no LLM call without StepTrace
2. When uncertain, stop and explain — never guess
3. Context boundaries must be explicitly designed — never mix slots
4. Retrieval quality must be validated before generation
5. Tool selection must be explainable — log reasoning always

---

## Confidence Thresholds

```go
const (
    ConfidenceThresholdCertain = 0.80
    ConfidenceThresholdHedged  = 0.50
    // Below 0.50 → stop, return UncertainInfo
)
```

---

## Research Foundation

| Paper | Key Insight |
|-------|-------------|
| HTC (Salesforce AI, 2026) | Evaluate full trajectory, not just final step |
| AgentHallu (2026) | 5 hallucination categories: Planning / Retrieval / Reasoning / Tool-Use / Human-Interaction |
| TrajAD (2026) | Detect anomalies in trajectory execution |
| TRACE (2026) | "High-score illusion" — correct answer ≠ correct reasoning |

---

## First Task for Claude Code

```
1. Show me the current project structure
   → ls -la and key Go files

2. Find where LLM is currently being called
   → Show me that code

3. Together, wrap it with StepTrace
   → Smallest possible change, highest possible impact
```

---

## Repository

- **Research lab**: https://github.com/hyungrok-oh/trustworthy-agent-lab
- **GitHub Pages**: https://hyungrok-oh.github.io/trustworthy-agent-lab/
- **CLAUDE.md location**: `.claude/CLAUDE.md`

---

_Generated from Claude.ai session · 2026.04_
_Delete this file after Claude Code session is established_
