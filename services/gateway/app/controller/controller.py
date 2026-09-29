"""gateway-side wrapper around prism_core.RulePolicy — ADR-0003. Owns one
RulePolicy per session (so drift/anchor state doesn't leak across sessions,
consistent with T7 in SECURITY.md) and the HTTP call to ml-service for
features; the decision logic itself lives entirely in prism_core.
"""
from __future__ import annotations

import httpx
from prism_core.controller import ChunkFeatures, RulePolicy
from prism_core.schemas import ControllerDecision


class SessionControllers:
    def __init__(self, ml_service_url: str) -> None:
        self.ml_service_url = ml_service_url
        self._policies: dict[str, RulePolicy] = {}
        self._last_entities: dict[str, tuple[str, ...]] = {}
        self._last_features: dict[str, ChunkFeatures] = {}

    def _policy_for(self, session_id: str) -> RulePolicy:
        if session_id not in self._policies:
            self._policies[session_id] = RulePolicy()
        return self._policies[session_id]

    def entities_for(self, session_id: str) -> list[str]:
        """Entities observed on the most recent chunk for this session — F2's
        "carries session entities" reads this after each controller decision.
        """
        return list(self._last_entities.get(session_id, ()))

    def features_for(self, session_id: str) -> dict | None:
        """The features the policy evaluated on this session's latest chunk,
        as a plain dict for the controller_decision telemetry event — so the
        dashboard's ruler/lamp show what the controller actually saw rather
        than a guess (frontend_prompt.md, headroom ruler + controller lamp).
        """
        f = self._last_features.get(session_id)
        if f is None:
            return None
        return {
            "content_tokens": f.content_tokens,
            "entities": list(f.entities),
            "clause_boundary": f.clause_boundary,
            "embedding_drift": round(f.embedding_drift, 4),
            "is_presentation_turn": f.is_presentation_turn,
        }

    def fetch_features(self, session_id: str, chunk_index: int, text: str) -> ChunkFeatures:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(
                f"{self.ml_service_url}/features",
                json={"session_id": session_id, "chunk_index": chunk_index, "text": text},
            )
            resp.raise_for_status()
            data = resp.json()
        return ChunkFeatures(
            chunk_index=data["chunk_index"],
            content_tokens=data["content_tokens"],
            entities=tuple(data["entities"]),
            clause_boundary=data["clause_boundary"],
            embedding_drift=data["embedding_drift"],
            is_presentation_turn=data["is_presentation_turn"],
        )

    def decide(self, session_id: str, chunk_index: int, text: str, trace_id: str) -> ControllerDecision:
        features = self.fetch_features(session_id, chunk_index, text)
        self._last_features[session_id] = features
        if features.entities:
            self._last_entities[session_id] = features.entities
        return self._policy_for(session_id).decide(features, trace_id=trace_id)
