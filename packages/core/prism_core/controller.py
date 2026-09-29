"""Rule-based retrieval controller — ADR-0003.

Deterministic, feature-driven Wait / Retrieve / No-Retrieval policy. No
network call, no LLM: this module must stay a pure function of its inputs so
it can be unit-tested without any service running and so its decisions are
explainable by reason code alone.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from prism_core.schemas import ControllerDecision, Decision


@dataclass
class ChunkFeatures:
    """Per-chunk features computed by ml-service (ADR-0003)."""

    chunk_index: int
    content_tokens: int
    entities: tuple[str, ...] = field(default_factory=tuple)
    clause_boundary: bool = False
    embedding_drift: float = 0.0
    is_presentation_turn: bool = False
    has_evidence_free_topic: bool = False


@dataclass
class ControllerConfig:
    min_content_tokens: int = 4
    drift_cancel_threshold: float = 0.35
    require_clause_boundary: bool = True


class RulePolicy:
    """v1 controller: hand-set thresholds, tuned on labelled eval streams."""

    def __init__(self, config: ControllerConfig | None = None) -> None:
        self.config = config or ControllerConfig()
        self._last_anchor_entities: tuple[str, ...] = ()

    def decide(self, features: ChunkFeatures, trace_id: str) -> ControllerDecision:
        cfg = self.config

        if features.is_presentation_turn:
            return ControllerDecision(
                decision=Decision.NO_RETRIEVAL,
                reason_code="PRESENTATION_TURN",
                chunk_index=features.chunk_index,
                trace_id=trace_id,
            )

        if features.embedding_drift >= cfg.drift_cancel_threshold and self._last_anchor_entities:
            # Mid-utterance topic change ("Pune... actually Mumbai"): cancel
            # the provisional query and re-anchor on this chunk's entities.
            self._last_anchor_entities = features.entities
            return ControllerDecision(
                decision=Decision.RETRIEVE,
                reason_code="DRIFT_ABOVE_THRESHOLD_REANCHOR",
                chunk_index=features.chunk_index,
                trace_id=trace_id,
            )

        if features.content_tokens < cfg.min_content_tokens:
            return ControllerDecision(
                decision=Decision.WAIT,
                reason_code="CONTENT_TOKENS_BELOW_MIN",
                chunk_index=features.chunk_index,
                trace_id=trace_id,
            )

        if cfg.require_clause_boundary and not features.clause_boundary:
            return ControllerDecision(
                decision=Decision.WAIT,
                reason_code="NO_CLAUSE_BOUNDARY",
                chunk_index=features.chunk_index,
                trace_id=trace_id,
            )

        if not features.entities:
            return ControllerDecision(
                decision=Decision.WAIT,
                reason_code="NO_STABLE_ENTITY",
                chunk_index=features.chunk_index,
                trace_id=trace_id,
            )

        self._last_anchor_entities = features.entities
        return ControllerDecision(
            decision=Decision.RETRIEVE,
            reason_code="ENTITY_STABLE_CLAUSE_END",
            chunk_index=features.chunk_index,
            trace_id=trace_id,
        )
