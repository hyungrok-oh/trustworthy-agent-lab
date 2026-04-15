# Personal Tracking System

> A sustainable learning routine for growing into a trustworthy agent specialist — without getting swept away by trends.

---

## Design Principle

**"Automate collection. Always judge yourself."**

A tracking system that's too complex to maintain is useless.
Design it to match the time you can realistically commit.

---

## Two-Layer Structure

### Core Layer — Non-negotiable (30 min/week)
Do this even when busy, even when tired. If this breaks, the whole system breaks.

### Extended Layer — When you have time
Missing this is fine. As long as Core is alive, the system is alive.

---

## Weekly Rhythm

| Day | Layer | Time | Content |
|-----|-------|------|---------|
| Monday | Core | 5 min | Trigger capture |
| Wednesday | Core | 5 min | Midweek check |
| Friday | Core | 20 min | Weekly review + radar update |
| Saturday | Extended | 2–3 hrs | Deep work — build something |
| Sunday | Extended | 1–2 hrs | Consolidate + monthly retrospective (once/month) |

---

## Core Layer Details

### Monday — Trigger Capture (5 min)

Record just one thing that caught your attention this week.

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

**Note template**:
```
Date: YYYY-MM-DD
Trigger: [title]
One-line note: [why did this catch your attention]
```

### Wednesday — Midweek Check (5 min)

Run Monday's trigger through the 3-question judgment filter.

```
Check:
✓ Does it solve a trust problem?
✓ Are people using it in production?
✓ Will it still be relevant in 6 months?

Result:
→ 2 or more Yes → carry forward to Friday review
→ Otherwise → discard (discarding is also an important decision)
```

### Friday — Weekly Review (20 min)

Place trigger on the tech radar and commit to notes/.

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

## Extended Layer Details

### Saturday — Deep Work (2–3 hrs)

Pick the most interesting thing from the week and implement it in code.

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

### Sunday — Consolidation (1–2 hrs)

Document Saturday's results and run the monthly retrospective once a month.

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

## Sources

### Primary — Original
```
- Anthropic blog / release notes
- arXiv cs.AI (keywords: Agent, Eval, Reliability)
- GitHub: Claude Code, OpenClaw, llm-d, vLLM
- Key people on X/Twitter
```

### Secondary — Curated
```
- TLDR AI (newsletter)
- The Batch (Andrew Ng)
- Latent Space podcast
```

### Reduce
```
- LinkedIn AI posts (high noise ratio)
- "X is changing AI forever" media
- Framework official blogs (marketing bias)
```

---

## Tools

| Tool | Purpose |
|------|---------|
| GitHub (this repo) | Tech radar + weekly notes |
| GitHub Watch | Change notifications for repos of interest |
| RSS + arXiv | Automated paper alerts |
| Obsidian (optional) | Local draft writing |

---

## Patterns That Break This System

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

## Expected Outcomes

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

## Weekly Note Template

Save as `notes/YYYY-MM-wN.md`

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

_v0.1 · 2026.04 · Designed around personal rhythm (weekdays 9–6 + evenings/weekends)_
