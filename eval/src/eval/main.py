"""FastAPI application for the evaluation server.

Receives StepTrace from the agent server, computes metrics on flush.

Endpoints:
    POST /api/traces                  — Receive a StepTrace from agent
    POST /api/traces/{trace_id}/flush — Trigger evaluation for a trace
    GET  /api/health                  — Health check
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

from eval.collector.receiver import TraceReceiver
from eval.config import Settings
from eval.core.models import StepTraceReceived
from eval.repository.trace import TraceRepository

# Configure root logger so app-level logger.info() reaches stdout.
# uvicorn only configures its own loggers (uvicorn, uvicorn.error,
# uvicorn.access) — without this, eval.main messages are silently
# dropped by Python's lastResort handler (WARNING+ only).
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory."""
    if settings is None:
        settings = Settings()

    # Build trace repository (sync creation, async operations in lifespan)
    trace_repo = None
    _motor_client = None
    if settings.mongodb_enabled:
        _motor_client = AsyncIOMotorClient(settings.mongodb_url)
        db = _motor_client[settings.mongodb_database]
        trace_repo = TraceRepository(db["traces"])

    receiver = TraceReceiver(repo=trace_repo)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        if trace_repo:
            await trace_repo.ensure_indexes()
            logger.info(
                "MongoDB connected: %s/%s",
                settings.mongodb_url,
                settings.mongodb_database,
            )
        logger.info(
            "Eval server started (mongodb=%s)",
            "enabled" if settings.mongodb_enabled else "disabled",
        )
        yield
        if _motor_client:
            _motor_client.close()

    app = FastAPI(
        title="Trustworthy Eval",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "eval"}

    @app.post("/api/traces")
    async def receive_trace(step: StepTraceReceived) -> dict[str, str]:
        await receiver.receive(step)
        return {"status": "received", "trace_id": step.trace_id}

    @app.post("/api/traces/{trace_id}/flush")
    async def flush_trace(trace_id: str) -> dict[str, Any]:
        metrics = await receiver.flush(trace_id)
        return {
            "trace_id": trace_id,
            "metrics": [asdict(m) for m in metrics],
        }

    return app
