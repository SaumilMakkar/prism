"""Reciprocal Rank Fusion — ADR-0002.

Fuses BM25 and dense ranked lists before cross-encoder rerank. Pure function:
takes ranked id lists in, returns a fused ranking out.
"""
from __future__ import annotations

from collections import defaultdict


def reciprocal_rank_fusion(
    ranked_lists: list[list[str]],
    k: int = 60,
) -> list[tuple[str, float]]:
    """Fuse N ranked lists of ids into one ranking.

    Standard RRF: score(id) = sum over lists of 1 / (k + rank_in_list).
    ``k`` dampens the influence of any single list's top rank so that
    agreement across lists (lexical + dense) outranks a single strong hit
    in only one of them.
    """
    scores: dict[str, float] = defaultdict(float)
    for ranked in ranked_lists:
        for rank, item_id in enumerate(ranked, start=1):
            scores[item_id] += 1.0 / (k + rank)

    return sorted(scores.items(), key=lambda pair: pair[1], reverse=True)
