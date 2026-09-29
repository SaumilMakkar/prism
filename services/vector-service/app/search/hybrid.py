"""Hybrid retrieval orchestration — ADR-0002. Pure logic, no I/O, so it is
unit-testable with fake BM25/dense rankings and no Qdrant/ml-service running.
"""
from __future__ import annotations

from dataclasses import dataclass

from prism_core.fusion import reciprocal_rank_fusion


@dataclass(frozen=True)
class RankedChunk:
    """One fused candidate plus where it came from — the provenance the
    evidence drawer shows (bm25 rank, dense rank, RRF score)."""

    chunk_id: str
    bm25_rank: int | None
    dense_rank: int | None
    rrf_score: float | None


def hybrid_rank_detailed(
    bm25_ids: list[str],
    dense_ids: list[str],
    hybrid_enabled: bool = True,
    top_k: int = 5,
) -> list[RankedChunk]:
    """Return the final ranked, deduped candidates with their provenance.

    ``hybrid_enabled=False`` is ablation 1 (ADR-0002): dense-only ranking,
    used by `make eval ABLATION=dense_only`.
    """
    bm25_rank = {cid: i for i, cid in enumerate(_dedupe(bm25_ids), start=1)}
    dense_rank = {cid: i for i, cid in enumerate(_dedupe(dense_ids), start=1)}

    if not hybrid_enabled:
        return [
            RankedChunk(cid, bm25_rank.get(cid), rank, None)
            for cid, rank in list(dense_rank.items())[:top_k]
        ]

    fused = reciprocal_rank_fusion([list(bm25_rank), list(dense_rank)])
    return [
        RankedChunk(cid, bm25_rank.get(cid), dense_rank.get(cid), score)
        for cid, score in fused[:top_k]
    ]


def hybrid_rank(
    bm25_ids: list[str],
    dense_ids: list[str],
    hybrid_enabled: bool = True,
    top_k: int = 5,
) -> list[str]:
    """Ids only — kept for callers and tests that don't need provenance."""
    return [r.chunk_id for r in hybrid_rank_detailed(bm25_ids, dense_ids, hybrid_enabled, top_k)]


def _dedupe(ids: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            result.append(i)
    return result
