from agent.core.context import Fact, WorkflowContext


def test_workflow_context_slot_separation() -> None:
    """Verify that context slots are independent and don't leak."""
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="What is the weather?",
    )
    assert ctx.system_prompt == "You are a helpful assistant."
    assert ctx.current_input == "What is the weather?"
    assert ctx.session_facts == []
    assert ctx.history_summary == ""
    assert ctx.current_step_idx == 0


def test_workflow_context_with_facts() -> None:
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="Tell me more.",
        session_facts=[
            Fact(key="user_name", value="Hyungrok", verified=True),
        ],
        history_summary="User asked about weather. Agent responded with forecast.",
        current_step_idx=1,
    )
    assert len(ctx.session_facts) == 1
    assert ctx.session_facts[0].verified is True
    assert ctx.current_step_idx == 1


def test_workflow_context_builds_messages() -> None:
    """Context should produce a clean message list for LLM call."""
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="Hello!",
        history_summary="Previous conversation about greetings.",
    )
    messages = ctx.to_messages()
    assert messages[0]["role"] == "system"
    assert "helpful assistant" in messages[0]["content"]
    assert messages[-1]["role"] == "user"
    assert messages[-1]["content"] == "Hello!"


def test_workflow_context_only_verified_facts_in_messages() -> None:
    """Only verified facts should appear in the system message."""
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="Hi",
        session_facts=[
            Fact(key="name", value="Hyungrok", verified=True),
            Fact(key="age", value="unknown", verified=False),
        ],
    )
    messages = ctx.to_messages()
    system_content = messages[0]["content"]
    assert "Hyungrok" in system_content
    assert "unknown" not in system_content


def test_workflow_context_no_history_no_section() -> None:
    """When history is empty, no history section in system message."""
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="Hi",
    )
    messages = ctx.to_messages()
    assert "[Conversation History]" not in messages[0]["content"]
