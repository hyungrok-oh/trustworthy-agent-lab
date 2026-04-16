"""File trace emitter — writes StepTrace to local JSONL files.

Used for development and debugging. Each trace_id gets its own directory
with a steps.jsonl file containing one JSON object per line.

Output structure:
    {output_dir}/
        {trace_id}/
            steps.jsonl    ← one StepTrace JSON per line
"""

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

from agent.core.trace import StepTrace


class FileTraceEmitter:
    """Write traces to local JSONL files for development inspection."""

    def __init__(self, *, output_dir: Path) -> None:
        self._output_dir = output_dir
        self._buffers: dict[str, list[dict[str, Any]]] = defaultdict(list)

    async def emit(self, step: StepTrace) -> None:
        self._buffers[step.trace_id].append(step.model_dump(mode="json"))

    async def flush(self, trace_id: str) -> None:
        """Write buffered steps to a JSONL file."""
        steps = self._buffers.pop(trace_id, [])
        if not steps:
            return

        trace_dir = self._output_dir / trace_id
        trace_dir.mkdir(parents=True, exist_ok=True)

        filepath = trace_dir / "steps.jsonl"
        with open(filepath, "w") as f:
            for step_data in steps:
                f.write(json.dumps(step_data, ensure_ascii=False) + "\n")
