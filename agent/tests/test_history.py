"""Tests for conversation history → recent_turns conversion.

main.py's chat handler converts MongoDB message dicts into Turn objects.
These tests verify that conversion logic via WorkflowContext.to_messages().
"""

from __future__ import annotations

from agent.core.context import Turn, WorkflowContext


def _make_turns(raw: list[dict[str, str]]) -> list[Turn]:
    """Mirror the conversion in main.py chat handler."""
    return [
        Turn(role=m["role"], content=m["content"])
        for m in raw
        if m["role"] in ("user", "assistant")
    ]


def test_empty_messages_yields_no_turns() -> None:
    turns = _make_turns([])
    assert turns == []


def test_messages_convert_to_turns() -> None:
    raw = [
        {"role": "user", "content": "hello", "timestamp": "2026-01-01"},
        {"role": "assistant", "content": "hi there", "timestamp": "2026-01-01"},
    ]
    turns = _make_turns(raw)
    assert len(turns) == 2
    assert turns[0] == Turn(role="user", content="hello")
    assert turns[1] == Turn(role="assistant", content="hi there")


def test_unknown_roles_are_filtered_out() -> None:
    raw = [
        {"role": "user", "content": "hello"},
        {"role": "system", "content": "injected"},
        {"role": "assistant", "content": "hi"},
    ]
    turns = _make_turns(raw)
    assert len(turns) == 2
    assert all(t.role in ("user", "assistant") for t in turns)


def test_turns_appear_as_real_messages_in_context() -> None:
    """Converted turns must show up as real user/assistant messages."""
    raw = [
        {"role": "user", "content": "msg-0"},
        {"role": "assistant", "content": "msg-1"},
    ]
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="msg-2",
        recent_turns=_make_turns(raw),
    )
    messages = ctx.to_messages()
    roles = [m["role"] for m in messages]
    assert roles == ["system", "user", "assistant", "user"]
    assert messages[-1]["content"] == "msg-2"
