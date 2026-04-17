"""FastAPI application for the trustworthy agent server.

Application Factory pattern with Lifespan for resource management.
Same pattern as llm-serving project's main.py.

Endpoints:
    POST /api/chat     — Process user message through conversation pipeline
    GET  /api/health   — Health check
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import FastAPI
from pydantic import BaseModel

from agent.config import Settings
from agent.emitter.file import FileTraceEmitter
from agent.emitter.http import HttpTraceEmitter
from agent.emitter.protocol import NoopTraceEmitter, TraceEmitter
from agent.llm.client import LLMClient
from agent.pipeline.conversation import ConversationPipeline

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

        state["pipeline"] = pipeline
        state["llm_client"] = llm_client
        state["emitter"] = emitter

        logger.info(
            "Agent server started (llm=%s, emitter=%s)",
            settings.llm_model,
            settings.trace_emitter,
        )
        yield

        # Shutdown — clean up resources
        await llm_client.close()
        if hasattr(emitter, "close"):
            await emitter.close()

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
        response = await pipeline.run(user_input=request.message)
        return response.model_dump(mode="json")

    return app
