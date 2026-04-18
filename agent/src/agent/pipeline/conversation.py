"""Minimal conversation pipeline — Phase 1 Augmented LLM.

Single LLM call wrapped with StepTrace. Every call is traced.
This is the simplest possible pipeline that satisfies all principles:

    Principle 2: WorkflowContext separates context slots
    Principle 4: Every LLM call produces a StepTrace
    Principle 5: Confidence judgment gates the response

Flow:
    User input → WorkflowContext → LLM call → StepTrace → Confidence → Response

Phase 2 extends this to Prompt Chaining (multiple sequential LLM calls).
Phase 3 adds Routing + Parallelization.
Phase 4 adds Autonomous Agent with tool selection.

Reference: Anthropic "Building Effective Agents" — Augmented LLM pattern
"""

from __future__ import annotations

import logging
import math
import time
from datetime import UTC, datetime

from agent.core.confidence import AgentResponse, judge_confidence
from agent.core.context import WorkflowContext
from agent.core.trace import (
    DynamicsSignal,
    StabilitySignal,
    StepError,
    StepTrace,
    StepType,
    TraceContext,
)
from agent.emitter.protocol import TraceEmitter
from agent.llm.client import LLMClient

logger = logging.getLogger(__name__)


class ConversationPipeline:
    """Phase 1: Augmented LLM — single LLM call with full traceability."""

    def __init__(
        self,
        *,
        llm_client: LLMClient,
        emitter: TraceEmitter,
        system_prompt: str,
    ) -> None:
        self._llm = llm_client
        self._emitter = emitter
        self._system_prompt = system_prompt

    async def run(
        self,
        *,
        user_input: str,
        history_summary: str = "",
    ) -> AgentResponse:
        """Execute the conversation pipeline with full tracing."""
        trace_ctx = TraceContext()

        # Build context with explicit slot separation (Principle 2)
        workflow_ctx = WorkflowContext(
            system_prompt=self._system_prompt,
            current_input=user_input,
            history_summary=history_summary,
        )

        # Single LLM call wrapped with StepTrace (Principle 4)
        step = await self._call_llm(trace_ctx, workflow_ctx)

        # Emit trace to eval server (OpenTelemetry pattern)
        await self._emitter.emit(step)
        await self._emitter.flush(trace_ctx.trace_id)

        # Confidence judgment (Principle 5)
        if step.error is not None:
            return judge_confidence(
                trace_id=trace_ctx.trace_id,
                answer="",
                steps=[step],
                final_confidence=0.0,
            )

        return judge_confidence(
            trace_id=trace_ctx.trace_id,
            answer=step.output.get("response", ""),
            steps=[step],
            final_confidence=step.confidence,
        )

    async def _call_llm(
        self,
        trace_ctx: TraceContext,
        workflow_ctx: WorkflowContext,
    ) -> StepTrace:
        """Make an LLM call and record it as a StepTrace.

        FORBIDDEN: calling LLM without creating a StepTrace.
        """
        step_id = trace_ctx.next_step_id()
        started_at = datetime.now(UTC)
        start_time = time.monotonic()

        messages = workflow_ctx.to_messages()

        try:
            llm_response = await self._llm.chat(messages)
            duration_ms = (time.monotonic() - start_time) * 1000

            confidence = self._estimate_confidence(llm_response.logprobs)

            return StepTrace(
                trace_id=trace_ctx.trace_id,
                step_id=step_id,
                step_type=StepType.LLM_CALL,
                is_first=True,
                is_last=True,
                input={"prompt": workflow_ctx.current_input},
                output={"response": llm_response.text},
                confidence=confidence,
                reasoning=f"LLM response with {llm_response.completion_tokens} tokens",
                dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
                stability=StabilitySignal(output_consistency=1.0),
                logprobs=llm_response.logprobs,
                started_at=started_at,
                duration_ms=duration_ms,
            )

        except Exception as e:
            duration_ms = (time.monotonic() - start_time) * 1000
            logger.error("LLM call failed: %s", e)

            return StepTrace(
                trace_id=trace_ctx.trace_id,
                step_id=step_id,
                step_type=StepType.LLM_CALL,
                is_first=True,
                is_last=True,
                input={"prompt": workflow_ctx.current_input},
                output={},
                confidence=0.0,
                reasoning=f"LLM call failed: {e}",
                dynamics=DynamicsSignal(confidence_delta=0.0, trend="stable"),
                stability=StabilitySignal(output_consistency=0.0),
                error=StepError(
                    code="llm_failure",
                    message=str(e),
                    failure_category="reasoning",
                ),
                started_at=started_at,
                duration_ms=duration_ms,
            )

    def _estimate_confidence(
        self, logprobs: list[list[float]] | None
    ) -> float:
        """Estimate confidence from token log-probabilities.

        Phase 1: simple average of top-1 logprobs converted to probability.
            confidence = mean(exp(top1_logprob) for each token)

        This is a naive estimator. Phase 2+ replaces this with
        the HTC calibrator in the eval server, which uses all 48
        features across the full trajectory.

        Why this works as a starting point:
            - High logprobs (close to 0) → model is sure → high confidence
            - Low logprobs (very negative) → model is unsure → low confidence
        """
        if not logprobs:
            return 0.7  # default when logprobs unavailable

        top1_probs = [
            math.exp(token_lps[0])
            for token_lps in logprobs
            if token_lps
        ]
        if not top1_probs:
            return 0.7

        return sum(top1_probs) / len(top1_probs)
