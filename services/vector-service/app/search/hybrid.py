"""Hybrid retrieval orchestration — ADR-0002. Pure logic, no I/O, so it is
unit-testable with fake BM25/dense rankings and no Qdrant/ml-service running.
"""
from __future__ import annotations

from prism_core.fusion import reciprocal_rank_fusion


def hybrid_rank(
    bm25_ids: list[str],
    dense_ids: list[str],
    hybrid_enabled: bool = True,
    top_k: int = 5,
) -> list[str]:
    """Return the final ranked, deduped chunk_ids.

    ``hybrid_enabled=False`` is ablation 1 (ADR-0002): dense-only ranking,
    used by `make eval ABLATION=dense_only`.
    """
    if not hybrid_enabled:
        return _dedupe(dense_ids)[:top_k]

    fused = reciprocal_rank_fusion([bm25_ids, dense_ids])
    return _dedupe([chunk_id for chunk_id, _ in fused])[:top_k]


def _dedupe(ids: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for i in ids:
        if i not in seen:
            seen.add(i)
            result.append(i)
    return result
