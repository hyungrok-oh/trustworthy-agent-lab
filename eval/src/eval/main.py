"""FastAPI application for the evaluation server.

Receives StepTrace from the agent server, computes metrics on flush.

Endpoints:
    POST /api/traces                  — Receive a StepTrace from agent
    POST /api/traces/{trace_id}/flush — Trigger evaluation for a trace
    GET  /api/health                  — Health check
"""

from __future__ import annotations

import logging
from dataclasses import asdict
from typing import Any

from fastapi import FastAPI

from eval.collector.receiver import TraceReceiver
from eval.config import Settings
from eval.core.models import StepTraceReceived

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory."""
    if settings is None:
        settings = Settings()

    receiver = TraceReceiver()

    app = FastAPI(
        title="Trustworthy Eval",
        version="0.1.0",
    )

    @app.get("/api/health")
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": "eval"}

    @app.post("/api/traces")
    async def receive_trace(step: StepTraceReceived) -> dict[str, str]:
        receiver.receive(step)
        return {"status": "received", "trace_id": step.trace_id}

    @app.post("/api/traces/{trace_id}/flush")
    async def flush_trace(trace_id: str) -> dict[str, Any]:
        metrics = receiver.flush(trace_id)
        return {
            "trace_id": trace_id,
            "metrics": [asdict(m) for m in metrics],
        }

    return app
