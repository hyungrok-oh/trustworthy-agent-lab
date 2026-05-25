from agent.core.context import Fact, Turn, WorkflowContext


def test_turn_model() -> None:
    t = Turn(role="user", content="hello")
    assert t.role == "user"
    assert t.content == "hello"


def test_workflow_context_slot_separation() -> None:
    """Verify that context slots are independent and don't leak."""
    ctx = WorkflowContext(
        system_prompt="You are a helpful assistant.",
        current_input="What is the weather?",
    )
    assert ctx.system_prompt == "You are a helpful assistant."
    assert ctx.current_input == "What is the weather?"
    assert ctx.session_facts == []
    assert ctx.recent_turns == []
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
    assert "[Earlier Summary]" not in messages[0]["content"]


def test_workflow_context_recent_turns_appear_as_real_messages() -> None:
    """recent_turns are injected as real user/assistant messages (ADR-001)."""
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="What next?",
        recent_turns=[
            Turn(role="user", content="Hello"),
            Turn(role="assistant", content="Hi there!"),
        ],
    )
    messages = ctx.to_messages()
    # system + 2 recent turns + current input = 4 messages
    assert len(messages) == 4
    assert messages[0]["role"] == "system"
    assert messages[1] == {"role": "user", "content": "Hello"}
    assert messages[2] == {"role": "assistant", "content": "Hi there!"}
    assert messages[3] == {"role": "user", "content": "What next?"}


def test_workflow_context_current_input_is_always_last() -> None:
    """current_input must always be the final message."""
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="Final question",
        recent_turns=[
            Turn(role="user", content="First"),
            Turn(role="assistant", content="Reply"),
        ],
    )
    messages = ctx.to_messages()
    assert messages[-1] == {"role": "user", "content": "Final question"}


def test_workflow_context_no_recent_turns_still_works() -> None:
    """Without recent_turns, structure is system + current_input only."""
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="Hi",
    )
    messages = ctx.to_messages()
    assert len(messages) == 2
    assert messages[0]["role"] == "system"
    assert messages[1] == {"role": "user", "content": "Hi"}


def test_workflow_context_summary_in_system_recent_turns_as_messages() -> None:
    """Earlier summary goes in system message; recent turns are real messages."""
    ctx = WorkflowContext(
        system_prompt="You are helpful.",
        current_input="Continue",
        history_summary="User discussed weather earlier.",
        recent_turns=[
            Turn(role="user", content="What about tomorrow?"),
            Turn(role="assistant", content="It will be sunny."),
        ],
    )
    messages = ctx.to_messages()
    # Summary in system message
    assert "[Earlier Summary]" in messages[0]["content"]
    assert "weather" in messages[0]["content"]
    # Recent turns as real messages
    assert messages[1]["role"] == "user"
    assert messages[2]["role"] == "assistant"
    assert messages[-1]["content"] == "Continue"
