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
    all_chunks = chunk_corpus(corpus_dir)

    # A superseded document version shares its doc_id and section numbers
    # with the current version (by design — see corpus/POL_004_warranty_return_v1.md
    # vs v2), so their citation_ids collide. Indexing both would silently
    # double-count that citation_id in RRF fusion (ADR-0002) and make the
    # id -> chunk lookup ambiguous for the verifier (ADR-0005). Superseded
    # chunks stay in the corpus as a fixture but are never retrievable as
    # current evidence.
    chunks = [c for c in all_chunks if c.status != "superseded"]
    bm25 = BM25Index(chunks)

    if dense_index is not None and chunks:
        vectors = embed_fn([c.text for c in chunks])
        dense_index.upsert(chunks, vectors)

    return chunks, bm25  # only the indexed (non-superseded) chunks
