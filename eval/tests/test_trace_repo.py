"""Tests for TraceRepository — mocks motor collection."""

from __future__ import annotations

from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest

from eval.core.models import DynamicsSignal, StabilitySignal, StepTraceReceived
from eval.repository.trace import TraceRepository


def _make_step(trace_id: str, step_id: int) -> StepTraceReceived:
    """Helper: create a minimal StepTraceReceived for testing."""
    return StepTraceReceived(
        trace_id=trace_id,
        step_id=step_id,
        step_type="llm_call",
        is_first=step_id == 0,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi"},
        confidence=0.85,
        reasoning="test",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=0.9),
        started_at=datetime.now(UTC),
        duration_ms=100.0,
    )


@pytest.fixture
def mock_collection() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def repo(mock_collection: AsyncMock) -> TraceRepository:
    return TraceRepository(mock_collection)


@pytest.mark.asyncio
async def test_save_step_upserts_with_push(
    repo: TraceRepository,
    mock_collection: AsyncMock,
) -> None:
    """save_step should $push the step into the trace document."""
    step = _make_step("trace-001", 0)
    await repo.save_step(step)

    mock_collection.update_one.assert_called_once()
    args, kwargs = mock_collection.update_one.call_args
    filter_doc, update_doc = args[0], args[1]

    assert filter_doc == {"trace_id": "trace-001"}
    assert "$push" in update_doc
    assert "$setOnInsert" in update_doc
    assert kwargs["upsert"] is True


@pytest.mark.asyncio
async def test_get_steps_returns_empty_for_unknown_trace(
    repo: TraceRepository,
    mock_collection: AsyncMock,
) -> None:
    """get_steps should return [] for an unknown trace_id."""
    mock_collection.find_one.return_value = None

    steps = await repo.get_steps("nonexistent")

    assert steps == []


@pytest.mark.asyncio
async def test_get_steps_returns_deserialized_steps(
    repo: TraceRepository,
    mock_collection: AsyncMock,
) -> None:
    """get_steps should deserialize stored dicts back to StepTraceReceived."""
    step = _make_step("trace-001", 0)
    mock_collection.find_one.return_value = {
        "trace_id": "trace-001",
        "steps": [step.model_dump(mode="json")],
    }

    steps = await repo.get_steps("trace-001")

    assert len(steps) == 1
    assert isinstance(steps[0], StepTraceReceived)
    assert steps[0].trace_id == "trace-001"
    assert steps[0].step_id == 0
    assert steps[0].confidence == 0.85


@pytest.mark.asyncio
async def test_delete_trace_returns_true_on_success(
    repo: TraceRepository,
    mock_collection: AsyncMock,
) -> None:
    """delete_trace should return True when a document was deleted."""
    mock_collection.delete_one.return_value = MagicMock(deleted_count=1)

    result = await repo.delete_trace("trace-001")

    assert result is True
    mock_collection.delete_one.assert_called_once_with({"trace_id": "trace-001"})


@pytest.mark.asyncio
async def test_delete_trace_returns_false_for_unknown(
    repo: TraceRepository,
    mock_collection: AsyncMock,
) -> None:
    """delete_trace should return False when nothing was deleted."""
    mock_collection.delete_one.return_value = MagicMock(deleted_count=0)

    result = await repo.delete_trace("nonexistent")

    assert result is False


@pytest.mark.asyncio
async def test_ensure_indexes(
    repo: TraceRepository,
    mock_collection: AsyncMock,
) -> None:
    """ensure_indexes should create trace_id unique index."""
    await repo.ensure_indexes()

    mock_collection.create_index.assert_called_once_with("trace_id", unique=True)
