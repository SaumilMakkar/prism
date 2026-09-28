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

    def _policy_for(self, session_id: str) -> RulePolicy:
        if session_id not in self._policies:
            self._policies[session_id] = RulePolicy()
        return self._policies[session_id]

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
        return self._policy_for(session_id).decide(features, trace_id=trace_id)
