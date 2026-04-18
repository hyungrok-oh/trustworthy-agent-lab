"""WorkflowContext with explicit slot separation.

Principle 2: Context boundaries must be explicitly designed.
Never implicitly mix results from previous steps with current input.

Slots:
    - Fixed zone: system_prompt (never modified)
    - Session zone: session_facts (verified facts only)
    - Current turn zone: current_input, current_step_idx (replaced every step)
    - History zone: history_summary (compressed, original removed)

FORBIDDEN: merging multiple slots into a single string without
clear section boundaries.

Reference: research/principles/trustworthy-agent-design.md (Principle 2)
Reference: TrajAD (2026) — context contamination spreads silently
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class Fact(BaseModel):
    """A verified fact from the session.

    Only facts with verified=True enter the LLM context.
    This prevents unverified assumptions from contaminating responses.
    """

    key: str
    value: str
    verified: bool = False


class WorkflowContext(BaseModel):
    """Explicitly separated context slots for LLM calls.

    Each zone has a clear lifecycle and update policy:
    - Fixed: set once at pipeline creation, never modified
    - Session: accumulated during conversation, only verified facts
    - Current: replaced every step, never carried over
    - History: compressed summary, originals discarded
    """

    # Fixed zone — set once, never modified during conversation
    system_prompt: str
    workflow_def: dict[str, Any] = {}

    # Session zone — only verified facts
    session_facts: list[Fact] = []

    # Current turn zone — replaced every step
    current_input: str
    current_step_idx: int = 0

    # History zone — compressed summary only, originals discarded
    history_summary: str = ""

    def to_messages(self) -> list[dict[str, str]]:
        """Build LLM message list with clear slot boundaries.

        System message includes fixed zone + session context.
        User message is strictly the current input.
        History is injected as system context, NOT as fake user/assistant turns.
        """
        system_parts: list[str] = [self.system_prompt]

        # Only verified facts enter the context
        verified = [f for f in self.session_facts if f.verified]
        if verified:
            facts_text = "\n".join(f"- {f.key}: {f.value}" for f in verified)
            system_parts.append(f"\n[Session Facts]\n{facts_text}")

        if self.history_summary:
            system_parts.append(
                f"\n[Conversation History]\n{self.history_summary}"
            )

        return [
            {"role": "system", "content": "\n".join(system_parts)},
            {"role": "user", "content": self.current_input},
        ]
