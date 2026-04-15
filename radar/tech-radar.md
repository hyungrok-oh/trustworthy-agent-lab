# Technology Radar

> Only technologies and concepts that pass the judgment filter make it here.
> Updated at the end of every month.

**Version**: v0.1
**Last updated**: 2026.04

---

## Judgment Filter (Placement Criteria)

| Question | Criteria |
|----------|----------|
| Does it solve a trust problem? | Core requirement |
| Are people using it in production? | Required |
| Will it still be relevant in 6 months? | Required |
| Does it only add complexity? | → Hold |
| Is there no way to measure it? | → Hold |

---

## Adopt — Use now

### Agent Eval Design
- **Why**: The foundation of trust. Can't deploy without measurement.
- **How**: LLM-as-judge, RAGAS, step-level evaluation
- **Basis**: HTC · AgentHallu · TRACE (2026)
- **Status**: ⬜ Not yet applied → planned

### .md Context Design Pattern
- **Why**: Control agents with natural language instead of code. CLAUDE.md, AGENTS.md pattern.
- **How**: Write CLAUDE.md at project root
- **Basis**: Claude Code, OpenClaw design philosophy
- **Status**: ✅ Applied (CLAUDE.md written)

### LLM Observability
- **Why**: Operational trust. No step tracing = no debugging.
- **How**: Langfuse or custom StepTrace structure
- **Basis**: TrajAD · hands-on experience
- **Status**: ⬜ Not yet applied → planned

---

## Trial — Currently experimenting

### Step-level Traceability (Go implementation)
- **Why**: Core implementation of Design Principle 4
- **How**: StepTrace struct-based logging
- **Status**: Design complete, implementation in progress

---

## Assess — Watching

### MCP (Model Context Protocol)
- **Why**: High potential for standardizing tool integration
- **Risk**: Still early, ecosystem uncertain
- **Reassess**: Q3 2026

### Prefill-Decode Separation Architecture
- **Why**: Infrastructure trend, useful for collaboration discussions
- **Risk**: Low chance of direct implementation
- **Reassess**: When collaborating with infra team

### On-device Agent (CoreML + MLX)
- **Why**: Blue ocean. Growing demand due to privacy concerns.
- **Risk**: Limited experience designing for constrained environments
- **Reassess**: Q3 2026, deeper exploration

---

## Hold — Not now

### LangChain / Over-abstracted Frameworks
- **Reason**: Abstraction complexity > benefit. Can't debug = can't trust.
- **Reconsider**: Never (structural issue)

### General-purpose Agent Platform Rebuild
- **Reason**: Validate use cases first, platform comes later.
- **Reconsider**: After domain-specific validation

---

## Changelog

| Date | Change |
|------|--------|
| 2026.04 | v0.1 initial draft. Based on HTC · AgentHallu · TrajAD · TRACE |

---

_Monthly updates · Judgment filter criteria maintained_
