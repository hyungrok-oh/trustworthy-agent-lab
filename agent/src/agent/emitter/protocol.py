"""TraceEmitter protocol — OpenTelemetry-inspired abstraction.

The agent doesn't know WHERE traces go. It only knows the protocol.
Implementations are swapped via configuration:
    - HttpTraceEmitter: push to eval server (production)
    - FileTraceEmitter: write to local JSONL (development)
    - NoopTraceEmitter: discard (eval server unavailable)

This is the same pattern as OpenTelemetry's Exporter interface:
    Tracer → Span → Exporter (Jaeger / Zipkin / Console / OTLP)
    Pipeline → StepTrace → TraceEmitter (Http / File / Noop)
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from agent.core.trace import StepTrace


@runtime_checkable
class TraceEmitter(Protocol):
    async def emit(self, step: StepTrace) -> None:
        """Emit a single step trace."""
        ...

    async def flush(self, trace_id: str) -> None:
        """Signal that a trace is complete. Triggers downstream processing."""
        ...


class NoopTraceEmitter:
    """Emitter that discards all traces. Used when eval is disabled."""

    async def emit(self, step: StepTrace) -> None:
        pass

    async def flush(self, trace_id: str) -> None:
        pass
