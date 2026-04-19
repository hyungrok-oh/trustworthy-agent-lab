"""Conversation history repository — MongoDB persistence.

Stores conversation messages per session_id with TTL expiry.
Design spec: docs/specs/2026-04-15-project-design.md Section 6 (agent_db.conversations)

Schema:
    conversations {
        session_id: string (index)
        messages: [{ role, content, timestamp }]
        created_at: datetime
        updated_at: datetime
        ttl_expire_at: datetime (TTL index, 7 days)
    }
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorCollection


class ConversationRepository:
    """CRUD operations for conversation history."""

    def __init__(self, collection: AsyncIOMotorCollection) -> None:
        self._collection = collection

    async def ensure_indexes(self) -> None:
        """Create indexes for efficient querying and TTL cleanup."""
        await self._collection.create_index("session_id")
        await self._collection.create_index(
            "ttl_expire_at", expireAfterSeconds=0
        )

    async def save_message(
        self, session_id: str, role: str, content: str
    ) -> None:
        """Append a message to the conversation document.

        Uses upsert: creates the document if this is the first message
        for the session. TTL is set to 7 days from first creation.
        """
        now = datetime.now(UTC)
        await self._collection.update_one(
            {"session_id": session_id},
            {
                "$push": {
                    "messages": {
                        "role": role,
                        "content": content,
                        "timestamp": now,
                    },
                },
                "$set": {"updated_at": now},
                "$setOnInsert": {
                    "created_at": now,
                    "ttl_expire_at": now + timedelta(days=7),
                },
            },
            upsert=True,
        )

    async def get_messages(
        self, session_id: str
    ) -> list[dict[str, Any]]:
        """Retrieve all messages for a session.

        Returns empty list if session doesn't exist.
        """
        doc = await self._collection.find_one(
            {"session_id": session_id},
            {"messages": 1},
        )
        if doc is None:
            return []
        return doc.get("messages", [])
