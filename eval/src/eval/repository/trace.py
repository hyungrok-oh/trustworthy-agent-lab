"""Trace repository — MongoDB persistence for step traces.

Stores step traces per trace_id as a single document with embedded array.
Design spec: docs/specs/2026-04-15-project-design.md Section 6 (eval_db.traces)

Schema:
    traces {
        trace_id: string (unique index)
        steps: [StepTraceReceived as JSON]
        received_at: datetime
        analyzed: boolean
    }
"""

from __future__ import annotations

from datetime import UTC, datetime

from motor.motor_asyncio import AsyncIOMotorCollection

from eval.core.models import StepTraceReceived


class TraceRepository:
    """CRUD operations for step trace persistence."""

    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def ensure_indexes(self) -> None:
        """Create unique index on trace_id for efficient lookups."""
        await self._collection.create_index("trace_id", unique=True)

    async def save_step(self, step: StepTraceReceived) -> None:
        """Append a step to the trace document.

        Uses upsert: creates the document on first step for a trace_id.
        Steps are stored as an embedded array within a single document.
        """
        await self._collection.update_one(
            {"trace_id": step.trace_id},
            {
                "$push": {"steps": step.model_dump(mode="json")},
                "$setOnInsert": {
                    "received_at": datetime.now(UTC),
                    "analyzed": False,
                },
            },
            upsert=True,
        )

    async def get_steps(self, trace_id: str) -> list[StepTraceReceived]:
        """Retrieve all steps for a trace, deserialized to model objects.

        Returns empty list if trace_id doesn't exist.
        """
        doc = await self._collection.find_one({"trace_id": trace_id})
        if doc is None:
            return []
        return [
            StepTraceReceived(**step_data)
            for step_data in doc.get("steps", [])
        ]

    async def delete_trace(self, trace_id: str) -> bool:
        """Delete a trace document after processing.

        Returns True if a document was deleted, False otherwise.
        """
        result = await self._collection.delete_one({"trace_id": trace_id})
        return result.deleted_count > 0
