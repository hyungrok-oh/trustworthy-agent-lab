"""Tests for ConversationRepository — mocks motor collection."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from agent.repository.conversation import ConversationRepository


@pytest.fixture
def mock_collection() -> AsyncMock:
    return AsyncMock()


@pytest.fixture
def repo(mock_collection: AsyncMock) -> ConversationRepository:
    return ConversationRepository(mock_collection)


@pytest.mark.asyncio
async def test_save_message_upserts_with_push(
    repo: ConversationRepository,
    mock_collection: AsyncMock,
) -> None:
    """save_message should $push a message and upsert the document."""
    await repo.save_message("session-1", "user", "hello")

    mock_collection.update_one.assert_called_once()
    args, kwargs = mock_collection.update_one.call_args
    filter_doc, update_doc = args[0], args[1]

    assert filter_doc == {"session_id": "session-1"}
    assert "$push" in update_doc
    pushed = update_doc["$push"]["messages"]
    assert pushed["role"] == "user"
    assert pushed["content"] == "hello"
    assert "timestamp" in pushed
    assert "$setOnInsert" in update_doc
    assert kwargs["upsert"] is True


@pytest.mark.asyncio
async def test_get_messages_returns_empty_for_unknown_session(
    repo: ConversationRepository,
    mock_collection: AsyncMock,
) -> None:
    """get_messages should return [] for a session with no history."""
    mock_collection.find_one.return_value = None

    messages = await repo.get_messages("nonexistent")

    assert messages == []
    mock_collection.find_one.assert_called_once()


@pytest.mark.asyncio
async def test_get_messages_returns_stored_messages(
    repo: ConversationRepository,
    mock_collection: AsyncMock,
) -> None:
    """get_messages should return the messages array from the document."""
    mock_collection.find_one.return_value = {
        "session_id": "session-1",
        "messages": [
            {"role": "user", "content": "hello", "timestamp": "2026-04-18T10:00:00Z"},
            {"role": "assistant", "content": "hi", "timestamp": "2026-04-18T10:00:01Z"},
        ],
    }

    messages = await repo.get_messages("session-1")

    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[0]["content"] == "hello"
    assert messages[1]["role"] == "assistant"


@pytest.mark.asyncio
async def test_ensure_indexes_creates_two_indexes(
    repo: ConversationRepository,
    mock_collection: AsyncMock,
) -> None:
    """ensure_indexes should create session_id index and TTL index."""
    await repo.ensure_indexes()

    assert mock_collection.create_index.call_count == 2
    calls = mock_collection.create_index.call_args_list
    assert calls[0][0][0] == "session_id"
    assert calls[1][0][0] == "ttl_expire_at"
    assert calls[1][1]["expireAfterSeconds"] == 0
