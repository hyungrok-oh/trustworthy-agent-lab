"""WorkflowContext with explicit slot separation.

Principle 2: Context boundaries must be explicitly designed.
Never implicitly mix results from previous steps with current input.

Slots:
    - Fixed zone: system_prompt (never modified)
    - Session zone: session_facts (verified facts only)
    - Current turn zone: current_input, current_step_idx (replaced every step)
    - History zone: recent_turns (real user/assistant messages) +
                    history_summary (older turns compressed to summary, Phase 2+)

FORBIDDEN: merging multiple slots into a single string without
clear section boundaries.

Reference: research/principles/trustworthy-agent-design.md (Principle 2)
Reference: TrajAD (2026) — context contamination spreads silently
Reference: ADR-001 (2026-05-25) — Context slot serialization strategy
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel


class Fact(BaseModel):
    """A verified fact from the session.

    Only facts with verified=True enter the LLM context.
    This prevents unverified assumptions from contaminating responses.
    """

    key: str
    value: str
    verified: bool = False


class Turn(BaseModel):
    """A single conversation turn from history.

    Injected as real user/assistant messages (not system context),
    so the model sees a natural alternating-turn format. (ADR-001)
    """

    role: Literal["user", "assistant"]
    content: str


class WorkflowContext(BaseModel):
    """Explicitly separated context slots for LLM calls.

    Each zone has a clear lifecycle and update policy:
    - Fixed: set once at pipeline creation, never modified
    - Session: accumulated during conversation, only verified facts
    - Current: replaced every step, never carried over
    - History (recent): real user/assistant turns, injected as actual messages
    - History (older): compressed summary in system message (Phase 2+, empty for now)
    """

    # Fixed zone — set once, never modified during conversation
    system_prompt: str
    workflow_def: dict[str, Any] = {}

    # Session zone — only verified facts
    session_facts: list[Fact] = []

    # Current turn zone — replaced every step
    current_input: str
    current_step_idx: int = 0

    # History zone — recent turns as real messages; older history as summary
    recent_turns: list[Turn] = []
    history_summary: str = ""  # Phase 2+: summarised overflow of older turns

    def to_messages(self) -> list[dict[str, str]]:
        """Build LLM message list with clear slot boundaries.

        Structure (ADR-001):
            [system]  system_prompt + [Session Facts] + [Earlier Summary]
            [user]    recent_turn[0]
            [assistant] recent_turn[1]
            ...
            [user]    current_input   ← always last

        Recent N turns as real user/assistant messages; older history as
        compressed summary in system message.
        """
        system_parts: list[str] = [self.system_prompt]

        # Only verified facts enter the context
        verified = [f for f in self.session_facts if f.verified]
        if verified:
            facts_text = "\n".join(f"- {f.key}: {f.value}" for f in verified)
            system_parts.append(f"\n[Session Facts]\n{facts_text}")

        if self.history_summary:
            system_parts.append(
                f"\n[Earlier Summary]\n{self.history_summary}"
            )

        messages: list[dict[str, str]] = [
            {"role": "system", "content": "\n".join(system_parts)},
        ]

        for turn in self.recent_turns:
            messages.append({"role": turn.role, "content": turn.content})

        messages.append({"role": "user", "content": self.current_input})
        return messages
