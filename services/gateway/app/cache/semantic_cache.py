"""Session-scoped semantic cache — F9 (prelude.md Section 9).

A sub-query whose embedding is within cosine >= THRESHOLD of one this
session already searched reuses that search's hits instead of hitting
vector-service again. Scope is strictly one session: entries are keyed by
session_id_hash and never consulted across sessions (SECURITY.md T7 —
no cross-session index, cache, or profile).

Pure Python, no I/O: the orchestrator supplies the vectors (from
ml-service /embed) so this module is unit-testable without a model.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from prism_core.schemas import RetrievalHit

DEFAULT_THRESHOLD = 0.9
DEFAULT_MAX_ENTRIES_PER_SESSION = 64


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


@dataclass
class CacheEntry:
    sub_query: str
    vector: list[float]
    hits: list[RetrievalHit]


@dataclass
class CacheLookup:
    entry: CacheEntry
    similarity: float


@dataclass
class SessionSemanticCache:
    threshold: float = DEFAULT_THRESHOLD
    max_entries_per_session: int = DEFAULT_MAX_ENTRIES_PER_SESSION
    _entries: dict[str, list[CacheEntry]] = field(default_factory=dict)

    def lookup(self, session_id_hash: str, vector: list[float]) -> CacheLookup | None:
        best: CacheLookup | None = None
        for entry in self._entries.get(session_id_hash, []):
            sim = cosine_similarity(entry.vector, vector)
            if sim >= self.threshold and (best is None or sim > best.similarity):
                best = CacheLookup(entry=entry, similarity=sim)
        return best

    def store(
        self, session_id_hash: str, sub_query: str, vector: list[float], hits: list[RetrievalHit]
    ) -> None:
        entries = self._entries.setdefault(session_id_hash, [])
        entries.append(CacheEntry(sub_query=sub_query, vector=vector, hits=list(hits)))
        if len(entries) > self.max_entries_per_session:
            del entries[: len(entries) - self.max_entries_per_session]

    def clear(self, session_id_hash: str) -> None:
        self._entries.pop(session_id_hash, None)

    def size(self, session_id_hash: str) -> int:
        return len(self._entries.get(session_id_hash, []))
