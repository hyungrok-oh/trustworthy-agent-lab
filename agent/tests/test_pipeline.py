from unittest.mock import AsyncMock

import pytest

from agent.core.confidence import AgentResponse
from agent.core.trace import StepTrace, StepType
from agent.emitter.protocol import NoopTraceEmitter
from agent.llm.client import LLMResponse
from agent.pipeline.conversation import ConversationPipeline


@pytest.fixture
def mock_llm_client() -> AsyncMock:
    client = AsyncMock()
    client.chat.return_value = LLMResponse(
        text="Hello! How can I help you?",
        logprobs=[[-0.1, -0.3], [-0.05, -0.2], [-0.1]],
        prompt_tokens=20,
        completion_tokens=8,
        finish_reason="stop",
    )
    return client


@pytest.fixture
def pipeline(mock_llm_client: AsyncMock) -> ConversationPipeline:
    return ConversationPipeline(
        llm_client=mock_llm_client,
        emitter=NoopTraceEmitter(),
        system_prompt="You are a helpful assistant.",
    )


@pytest.mark.asyncio
async def test_pipeline_returns_agent_response(
    pipeline: ConversationPipeline,
) -> None:
    response = await pipeline.run(user_input="Hello!")
    assert isinstance(response, AgentResponse)
    assert response.answer is not None
    assert response.trace_id != ""
    assert len(response.steps) >= 1


@pytest.mark.asyncio
async def test_pipeline_creates_step_trace(
    pipeline: ConversationPipeline,
    mock_llm_client: AsyncMock,
) -> None:
    response = await pipeline.run(user_input="Hello!")
    step = response.steps[0]

    assert step.step_type == StepType.LLM_CALL
    assert step.is_first is True
    assert step.is_last is True
    assert step.input["prompt"] == "Hello!"
    assert "Hello! How can I help you?" in step.output["response"]
    assert step.logprobs is not None
    assert step.duration_ms > 0


@pytest.mark.asyncio
async def test_pipeline_emits_trace(
    mock_llm_client: AsyncMock,
) -> None:
    mock_emitter = AsyncMock()
    pipeline = ConversationPipeline(
        llm_client=mock_llm_client,
        emitter=mock_emitter,
        system_prompt="You are a helpful assistant.",
    )
    await pipeline.run(user_input="Hello!")

    mock_emitter.emit.assert_called_once()
    mock_emitter.flush.assert_called_once()

    emitted_step = mock_emitter.emit.call_args[0][0]
    assert isinstance(emitted_step, StepTrace)


@pytest.mark.asyncio
async def test_pipeline_handles_llm_failure(
    mock_llm_client: AsyncMock,
) -> None:
    mock_llm_client.chat.side_effect = Exception("connection timeout")
    pipeline = ConversationPipeline(
        llm_client=mock_llm_client,
        emitter=NoopTraceEmitter(),
        system_prompt="You are a helpful assistant.",
    )

    response = await pipeline.run(user_input="Hello!")

    assert response.status == "uncertain"
    assert response.uncertainty is not None
    assert len(response.steps) == 1
    assert response.steps[0].error is not None
    assert response.steps[0].error.failure_category == "reasoning"


@pytest.mark.asyncio
async def test_pipeline_confidence_from_logprobs(
    pipeline: ConversationPipeline,
) -> None:
    """Confidence should be derived from logprobs, not hardcoded."""
    response = await pipeline.run(user_input="Hello!")
    # logprobs are [[-0.1, -0.3], [-0.05, -0.2], [-0.1]]
    # top-1 probs: exp(-0.1) ≈ 0.905, exp(-0.05) ≈ 0.951, exp(-0.1) ≈ 0.905
    # average ≈ 0.92 → should be "confident"
    assert response.status == "confident"
    assert response.confidence > 0.8
