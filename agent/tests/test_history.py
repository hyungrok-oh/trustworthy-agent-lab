"""Tests for conversation history summary builder."""

from __future__ import annotations

from agent.main import _build_history_summary


def test_build_history_summary_empty() -> None:
    assert _build_history_summary([]) == ""


def test_build_history_summary_formats_messages() -> None:
    messages = [
        {"role": "user", "content": "hello"},
        {"role": "assistant", "content": "hi there"},
    ]
    result = _build_history_summary(messages)
    assert "user: hello" in result
    assert "assistant: hi there" in result


def test_build_history_summary_caps_at_10_messages() -> None:
    """Only the last 10 messages should be included (Principle 2: bounded context)."""
    messages = [{"role": "user", "content": f"msg-{i}"} for i in range(20)]
    result = _build_history_summary(messages)
    assert "msg-10" in result
    assert "msg-19" in result
    assert "msg-9" not in result
