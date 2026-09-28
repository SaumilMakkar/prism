"""Corpus ingestion — F4. Walks `corpus/`, chunks, embeds via ml-service,
and builds the BM25 + Qdrant indexes. Ingestion is one-time and batched
(ADR-0002 consequence): there is no incremental-update path in v1.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

from app.chunking.chunking import Chunk, chunk_corpus
from app.search.bm25_index import BM25Index
from app.search.dense_index import DenseIndex

EmbedFn = Callable[[list[str]], list[list[float]]]


def ingest_corpus(
    corpus_dir: Path,
    embed_fn: EmbedFn,
    dense_index: DenseIndex | None = None,
) -> tuple[list[Chunk], BM25Index]:
    chunks = chunk_corpus(corpus_dir)
    bm25 = BM25Index(chunks)

    if dense_index is not None and chunks:
        vectors = embed_fn([c.text for c in chunks])
        dense_index.upsert(chunks, vectors)

    return chunks, bm25
