"""FastAPI application for the trustworthy agent server.

Application Factory pattern with Lifespan for resource management.
Same pattern as llm-serving project's main.py.

Endpoints:
    POST /api/chat     — Process user message through conversation pipeline
    GET  /api/health   — Health check
"""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel

from agent.config import Settings
from agent.emitter.file import FileTraceEmitter
from agent.emitter.http import HttpTraceEmitter
from agent.emitter.protocol import NoopTraceEmitter, TraceEmitter
from agent.llm.client import LLMClient
from agent.pipeline.conversation import ConversationPipeline
from agent.repository.conversation import ConversationRepository

# Configure root logger so app-level logger.info() reaches stdout.
# uvicorn only configures its own loggers (uvicorn, uvicorn.error,
# uvicorn.access) — without this, agent.main messages are silently
# dropped by Python's lastResort handler (WARNING+ only).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


def _build_emitter(settings: Settings) -> TraceEmitter:
    """Factory: select TraceEmitter implementation from config."""
    match settings.trace_emitter:
        case "http":
            return HttpTraceEmitter(eval_base_url=settings.eval_base_url)
        case "file":
            return FileTraceEmitter(output_dir=Path(settings.trace_file_path))
        case _:
            return NoopTraceEmitter()


def _build_history_summary(messages: list[dict[str, Any]]) -> str:
    """Build history summary from stored conversation messages.

    Simple concatenation of recent messages. Phase 2+ may replace
    this with LLM-based summarization for longer conversations.

    Cap at 10 most recent messages to keep context bounded
    (Principle 2: context boundaries must be explicit).
    """
    if not messages:
        return ""
    recent = messages[-10:]
    parts = [f"{msg['role']}: {msg['content']}" for msg in recent]
    return "\n".join(parts)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory with dependency injection."""
    if settings is None:
        settings = Settings()

    state: dict[str, Any] = {}

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Startup — initialize resources
        llm_client = LLMClient(
            base_url=settings.llm_base_url,
            model=settings.llm_model,
            temperature=settings.llm_temperature,
            timeout_seconds=settings.llm_timeout_seconds,
        )
        emitter = _build_emitter(settings)
        pipeline = ConversationPipeline(
            llm_client=llm_client,
            emitter=emitter,
            system_prompt=(
                "You are a helpful, trustworthy assistant. "
                "When you are uncertain, say so clearly."
            ),
        )

        # MongoDB (optional — disabled in tests)
        conversation_repo = None
        motor_client = None
        if settings.mongodb_enabled:
            motor_client = AsyncIOMotorClient(settings.mongodb_url)
            db = motor_client[settings.mongodb_database]
            conversation_repo = ConversationRepository(db["conversations"])
            await conversation_repo.ensure_indexes()
            logger.info(
                "MongoDB connected: %s/%s",
                settings.mongodb_url,
                settings.mongodb_database,
            )

        state["pipeline"] = pipeline
        state["llm_client"] = llm_client
        state["emitter"] = emitter
        state["conversation_repo"] = conversation_repo
        state["motor_client"] = motor_client

        logger.info(
            "Agent server started (llm=%s, emitter=%s, mongodb=%s)",
            settings.llm_model,
            settings.trace_emitter,
            "enabled" if settings.mongodb_enabled else "disabled",
        )
        yield

        # Shutdown — clean up resources
        await llm_client.close()
        if hasattr(emitter, "close"):
            await emitter.close()
        if motor_client:
            motor_client.close()

    app = FastAPI(
        title="Trustworthy Agent",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "agent"}

    @app.post("/api/chat")
    async def chat(request: ChatRequest) -> dict[str, Any]:
        pipeline: ConversationPipeline = state["pipeline"]
        conversation_repo: ConversationRepository | None = state.get(
            "conversation_repo"
        )

        session_id = request.session_id or str(uuid.uuid4())

        # Load conversation history (Principle 2: explicit context boundary)
        history_summary = ""
        if conversation_repo:
            try:
                messages = await conversation_repo.get_messages(session_id)
                history_summary = _build_history_summary(messages)
            except Exception as e:
                logger.warning("Failed to load conversation history: %s", e)

        response = await pipeline.run(
            user_input=request.message,
            history_summary=history_summary,
        )

        # Persist conversation (skip if MongoDB unavailable)
        if conversation_repo:
            try:
                await conversation_repo.save_message(
                    session_id, "user", request.message
                )
                if response.answer:
                    await conversation_repo.save_message(
                        session_id, "assistant", response.answer
                    )
            except Exception as e:
                logger.warning("Failed to save conversation: %s", e)

        result = response.model_dump(mode="json")
        result["session_id"] = session_id
        return result

    return app
