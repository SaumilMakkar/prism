from __future__ import annotations

import re

from rank_bm25 import BM25Okapi

from app.chunking.chunking import Chunk

_TOKEN_RE = re.compile(r"[A-Za-z0-9]+")


def tokenize(text: str) -> list[str]:
    return [t.lower() for t in _TOKEN_RE.findall(text)]


class BM25Index:
    def __init__(self, chunks: list[Chunk]) -> None:
        self.chunks = chunks
        self._corpus_tokens = [tokenize(c.text) for c in chunks]
        self._bm25 = BM25Okapi(self._corpus_tokens) if chunks else None

    def search(self, query: str, top_n: int = 10) -> list[str]:
        """Return chunk_ids ranked by BM25 score, descending."""
        if not self._bm25:
            return []
        scores = self._bm25.get_scores(tokenize(query))
        ranked = sorted(
            range(len(self.chunks)), key=lambda i: scores[i], reverse=True
        )
        return [self.chunks[i].chunk_id for i in ranked[:top_n]]
