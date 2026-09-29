from __future__ import annotations

import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from prism_core.schemas import RetrievalHit
from pydantic import BaseModel
from qdrant_client import QdrantClient

from app.chunking.chunking import Chunk
from app.ingest.ingest import ingest_corpus
from app.search.bm25_index import BM25Index
from app.search.dense_index import DenseIndex
from app.search.hybrid import hybrid_rank_detailed

CORPUS_DIR = Path(os.environ.get("CORPUS_DIR", "/corpus"))
ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://ml-service:8001")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant:6333")
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "384"))
# ADR-0002: BM25 + dense -> RRF -> cross-encoder rerank. The rerank stage
# runs over the fused top RERANK_CANDIDATES and is what decides the final
# top_k order; RERANK_ENABLED=false skips it (ablation / latency budget).
RERANK_ENABLED = os.environ.get("RERANK_ENABLED", "true").lower() == "true"
RERANK_CANDIDATES = int(os.environ.get("RERANK_CANDIDATES", "10"))

app = FastAPI(title="vector-service")

state: dict = {"chunks": [], "bm25": BM25Index([]), "dense": None, "by_id": {}}


def embed_via_ml_service(texts: list[str]) -> list[list[float]]:
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{ML_SERVICE_URL}/embed", json={"texts": texts})
        resp.raise_for_status()
        return resp.json()["vectors"]


def rerank_via_ml_service(query: str, candidates: list[str]) -> list[int]:
    """Best-first candidate indices from ml-service's cross-encoder (or its
    lexical fallback under ML_BACKEND=hash). A rerank failure must not turn
    a good fused ranking into a 5xx, so it degrades to the fused order."""
    if not candidates:
        return []
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(f"{ML_SERVICE_URL}/rerank", json={"query": query, "candidates": candidates})
            resp.raise_for_status()
            order = resp.json()["order"]
    except Exception:
        return list(range(len(candidates)))
    if sorted(order) != list(range(len(candidates))):
        return list(range(len(candidates)))
    return order


class SearchResponse(BaseModel):
    hits: list[RetrievalHit]


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "chunks_indexed": len(state["chunks"])}


@app.post("/ingest")
def ingest() -> dict:
    try:
        client = QdrantClient(url=QDRANT_URL)
        dense = DenseIndex(client, vector_size=EMBEDDING_DIM)
    except Exception:
        dense = None

    chunks, bm25 = ingest_corpus(CORPUS_DIR, embed_via_ml_service, dense)
    state["chunks"] = chunks
    state["bm25"] = bm25
    state["dense"] = dense
    state["by_id"] = {c.chunk_id: c for c in chunks}
    return {"ingested_chunks": len(chunks)}


@app.get("/search", response_model=SearchResponse)
def search(query: str, top_k: int = 5, hybrid: bool = True) -> SearchResponse:
    if not state["chunks"]:
        raise HTTPException(status_code=409, detail="corpus not ingested yet — call POST /ingest")

    bm25_ids = state["bm25"].search(query, top_n=20)

    dense_ids: list[str] = []
    if state["dense"] is not None:
        query_vector = embed_via_ml_service([query])[0]
        dense_ids = state["dense"].search(query_vector, top_n=20)

    candidate_k = max(top_k, RERANK_CANDIDATES) if RERANK_ENABLED else top_k
    ranked = hybrid_rank_detailed(bm25_ids, dense_ids, hybrid_enabled=hybrid, top_k=candidate_k)

    by_id: dict[str, Chunk] = state["by_id"]
    ranked = [r for r in ranked if r.chunk_id in by_id]

    rerank_rank: dict[str, int] = {}
    if RERANK_ENABLED and ranked:
        order = rerank_via_ml_service(query, [by_id[r.chunk_id].text for r in ranked])
        ranked = [ranked[i] for i in order]
        rerank_rank = {r.chunk_id: pos for pos, r in enumerate(ranked, start=1)}
    ranked = ranked[:top_k]

    hits: list[RetrievalHit] = []
    for r in ranked:
        chunk = by_id[r.chunk_id]
        hits.append(
            RetrievalHit(
                doc_id=chunk.doc_id,
                section=chunk.section,
                text=chunk.text,
                score=r.rrf_score if r.rrf_score is not None else 1.0,
                source="fused" if hybrid else "dense",
                doc_title=chunk.doc_title,
                heading=chunk.heading,
                version=chunk.version,
                effective_date=chunk.effective_date,
                bm25_rank=r.bm25_rank,
                dense_rank=r.dense_rank,
                rrf_score=r.rrf_score,
                rerank_rank=rerank_rank.get(r.chunk_id),
            )
        )
    return SearchResponse(hits=hits)
