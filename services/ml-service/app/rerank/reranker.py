"""Cross-encoder rerank — ADR-0002 (MiniLM, ~22M params)."""
from __future__ import annotations

from typing import Protocol

MODEL_NAME = "cross-encoder/ms-marco-MiniLM-L-6-v2"


class Reranker(Protocol):
    def rerank(self, query: str, candidates: list[str]) -> list[int]: ...


class CrossEncoderReranker:
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        from sentence_transformers import CrossEncoder

        self._model = CrossEncoder(model_name)

    def rerank(self, query: str, candidates: list[str]) -> list[int]:
        """Return candidate indices sorted best-first."""
        if not candidates:
            return []
        pairs = [(query, c) for c in candidates]
        scores = self._model.predict(pairs)
        return sorted(range(len(candidates)), key=lambda i: scores[i], reverse=True)


class LexicalOverlapReranker:
    """Dependency-free fallback: token-overlap scoring. Used in unit tests
    and as a documented lightweight alternative — never the `live` default.
    """

    def rerank(self, query: str, candidates: list[str]) -> list[int]:
        query_tokens = set(query.lower().split())
        scores = []
        for c in candidates:
            cand_tokens = set(c.lower().split())
            overlap = len(query_tokens & cand_tokens)
            scores.append(overlap)
        return sorted(range(len(candidates)), key=lambda i: scores[i], reverse=True)
