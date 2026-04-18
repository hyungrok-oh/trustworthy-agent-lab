import pytest

from agent.llm.client import LLMClient, LLMResponse


@pytest.fixture
def llm_client() -> LLMClient:
    return LLMClient(
        base_url="http://localhost:8000",
        model="test-model",
        temperature=0.0,
        timeout_seconds=10,
    )


def test_llm_client_builds_request_body(llm_client: LLMClient) -> None:
    """Verify request body includes logprobs parameter."""
    messages = [
        {"role": "system", "content": "You are helpful."},
        {"role": "user", "content": "Hello"},
    ]
    body = llm_client._build_request_body(messages)
    assert body["model"] == "test-model"
    assert body["temperature"] == 0.0
    assert body["logprobs"] is True
    assert body["top_logprobs"] == 5
    assert body["messages"] == messages


def test_llm_response_model() -> None:
    """Verify LLMResponse holds all required fields."""
    resp = LLMResponse(
        text="Hello there!",
        logprobs=[[-0.1, -0.3], [-0.2]],
        prompt_tokens=10,
        completion_tokens=5,
        finish_reason="stop",
    )
    assert resp.text == "Hello there!"
    assert resp.logprobs is not None
    assert resp.prompt_tokens == 10


def test_llm_response_without_logprobs() -> None:
    """LLMResponse should work without logprobs."""
    resp = LLMResponse(
        text="Hi!",
        logprobs=None,
        prompt_tokens=5,
        completion_tokens=2,
        finish_reason="stop",
    )
    assert resp.logprobs is None
