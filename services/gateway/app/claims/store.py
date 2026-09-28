"""Redis-backed session claim graph — ADR-0004. TTL 30 minutes, keyed by
session id only (no user identity field anywhere in this schema — T6/T7 in
SECURITY.md). Wraps prism_core.SessionClaimGraph so the diff/versioning
semantics live in one tested place and this module only owns persistence.
"""
from __future__ import annotations

import json
import os
from typing import Protocol

from prism_core.claim_graph import SessionClaimGraph
from prism_core.schemas import Claim, ClaimDiff

SESSION_TTL_SECONDS = int(os.environ.get("SESSION_TTL_SECONDS", str(30 * 60)))


class KeyValueStore(Protocol):
    def get(self, key: str) -> bytes | None: ...
    def set(self, key: str, value: str, ex: int) -> None: ...
    def delete(self, key: str) -> None: ...


class InMemoryStore:
    """Used in unit tests and local dev without a Redis dependency."""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def get(self, key: str) -> bytes | None:
        val = self._data.get(key)
        return val.encode("utf-8") if val is not None else None

    def set(self, key: str, value: str, ex: int) -> None:
        self._data[key] = value

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


def _key(session_id_hash: str) -> str:
    return f"prelude:claims:{session_id_hash}"


class ClaimGraphStore:
    def __init__(self, store: KeyValueStore) -> None:
        self.store = store

    def load(self, session_id_hash: str) -> SessionClaimGraph:
        raw = self.store.get(_key(session_id_hash))
        graph = SessionClaimGraph(session_id_hash=session_id_hash)
        if raw is not None:
            data = json.loads(raw)
            graph._graph.claims = {
                cid: Claim.model_validate(c) for cid, c in data["claims"].items()
            }
            graph._graph.version = data["version"]
        return graph

    def save(self, graph: SessionClaimGraph) -> None:
        payload = {
            "claims": {cid: c.model_dump(mode="json") for cid, c in graph.graph.claims.items()},
            "version": graph.graph.version,
        }
        self.store.set(_key(graph.graph.session_id_hash), json.dumps(payload), ex=SESSION_TTL_SECONDS)

    def upsert(self, session_id_hash: str, claims: list[Claim]) -> ClaimDiff:
        graph = self.load(session_id_hash)
        diff = graph.upsert(claims)
        self.save(graph)
        return diff

    def render(self, session_id_hash: str) -> list[Claim]:
        return self.load(session_id_hash).render()

    def expire_now(self, session_id_hash: str) -> None:
        self.store.delete(_key(session_id_hash))
