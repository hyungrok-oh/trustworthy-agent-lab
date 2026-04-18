import json
from datetime import UTC, datetime
from pathlib import Path

import pytest

from agent.core.trace import (
    DynamicsSignal,
    StabilitySignal,
    StepTrace,
    StepType,
)
from agent.emitter.file import FileTraceEmitter
from agent.emitter.protocol import NoopTraceEmitter, TraceEmitter


def _make_trace(trace_id: str = "emit-test-001", step_id: int = 0) -> StepTrace:
    return StepTrace(
        trace_id=trace_id,
        step_id=step_id,
        step_type=StepType.LLM_CALL,
        is_first=step_id == 0,
        is_last=True,
        input={"prompt": "hello"},
        output={"response": "hi"},
        confidence=0.85,
        reasoning="test",
        dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
        stability=StabilitySignal(output_consistency=1.0),
        started_at=datetime.now(UTC),
        duration_ms=100.0,
    )


@pytest.mark.asyncio
async def test_file_emitter_writes_trace(tmp_path: Path) -> None:
    emitter = FileTraceEmitter(output_dir=tmp_path)
    step = _make_trace()

    await emitter.emit(step)
    await emitter.flush("emit-test-001")

    files = list(tmp_path.glob("emit-test-001/*.jsonl"))
    assert len(files) == 1

    with open(files[0]) as f:
        lines = f.readlines()
    assert len(lines) == 1

    data = json.loads(lines[0])
    assert data["trace_id"] == "emit-test-001"
    assert data["step_type"] == "llm_call"


@pytest.mark.asyncio
async def test_file_emitter_multiple_steps(tmp_path: Path) -> None:
    emitter = FileTraceEmitter(output_dir=tmp_path)

    await emitter.emit(_make_trace(step_id=0))
    await emitter.emit(_make_trace(step_id=1))
    await emitter.flush("emit-test-001")

    files = list(tmp_path.glob("emit-test-001/*.jsonl"))
    with open(files[0]) as f:
        lines = f.readlines()
    assert len(lines) == 2


@pytest.mark.asyncio
async def test_file_emitter_flush_without_emit(tmp_path: Path) -> None:
    """Flush with no buffered steps should not create files."""
    emitter = FileTraceEmitter(output_dir=tmp_path)
    await emitter.flush("nonexistent")

    files = list(tmp_path.glob("**/*.jsonl"))
    assert len(files) == 0


def test_noop_satisfies_protocol() -> None:
    assert isinstance(NoopTraceEmitter(), TraceEmitter)


def test_file_satisfies_protocol(tmp_path: Path) -> None:
    assert isinstance(FileTraceEmitter(output_dir=tmp_path), TraceEmitter)
