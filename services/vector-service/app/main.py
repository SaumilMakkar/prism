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
from app.search.hybrid import hybrid_rank

CORPUS_DIR = Path(os.environ.get("CORPUS_DIR", "/corpus"))
ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://ml-service:8001")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://qdrant:6333")
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "384"))

app = FastAPI(title="vector-service")

state: dict = {"chunks": [], "bm25": BM25Index([]), "dense": None, "by_id": {}}


def embed_via_ml_service(texts: list[str]) -> list[list[float]]:
    with httpx.Client(timeout=30.0) as client:
        resp = client.post(f"{ML_SERVICE_URL}/embed", json={"texts": texts})
        resp.raise_for_status()
        return resp.json()["vectors"]


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

    ranked_ids = hybrid_rank(bm25_ids, dense_ids, hybrid_enabled=hybrid, top_k=top_k)

    hits: list[RetrievalHit] = []
    by_id: dict[str, Chunk] = state["by_id"]
    for chunk_id in ranked_ids:
        chunk = by_id.get(chunk_id)
        if chunk is None:
            continue
        hits.append(
            RetrievalHit(
                doc_id=chunk.doc_id,
                section=chunk.section,
                text=chunk.text,
                score=1.0,
                source="fused" if hybrid else "dense",
            )
        )
    return SearchResponse(hits=hits)
