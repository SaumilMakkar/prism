from __future__ import annotations

import os

from fastapi import FastAPI
from pydantic import BaseModel

from app.embed.embedder import DeterministicHashEmbedder, Embedder, SentenceTransformerEmbedder
from app.features.features import extract_all, is_presentation_turn
from app.nli.nli import LexicalEntailmentHeuristic, NliChecker, TransformerNliChecker
from app.rerank.reranker import CrossEncoderReranker, LexicalOverlapReranker, Reranker

BACKEND = os.environ.get("ML_BACKEND", "hash")  # "hash" (fast/offline) | "transformer" (real models)

app = FastAPI(title="ml-service")

_embedder: Embedder = (
    SentenceTransformerEmbedder() if BACKEND == "transformer" else DeterministicHashEmbedder()
)
_reranker: Reranker = CrossEncoderReranker() if BACKEND == "transformer" else LexicalOverlapReranker()
_nli: NliChecker = TransformerNliChecker() if BACKEND == "transformer" else LexicalEntailmentHeuristic()

_session_vectors: dict[str, list[float]] = {}


class EmbedRequest(BaseModel):
    texts: list[str]


class EmbedResponse(BaseModel):
    vectors: list[list[float]]


class FeaturesRequest(BaseModel):
    session_id: str
    chunk_index: int
    text: str


class FeaturesResponse(BaseModel):
    chunk_index: int
    content_tokens: int
    entities: list[str]
    clause_boundary: bool
    embedding_drift: float
    is_presentation_turn: bool


class RerankRequest(BaseModel):
    query: str
    candidates: list[str]


class RerankResponse(BaseModel):
    order: list[int]


class NliRequest(BaseModel):
    premise: str
    hypothesis: str


class NliResponse(BaseModel):
    entailed: bool


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "backend": BACKEND}


@app.post("/embed", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    return EmbedResponse(vectors=_embedder.encode(req.texts))


@app.post("/features", response_model=FeaturesResponse)
def features(req: FeaturesRequest) -> FeaturesResponse:
    curr_vector = _embedder.encode([req.text])[0]
    prev_vector = _session_vectors.get(req.session_id)
    result = extract_all(req.text, prev_vector, curr_vector)
    _session_vectors[req.session_id] = curr_vector
    return FeaturesResponse(
        chunk_index=req.chunk_index,
        content_tokens=result["content_tokens"],
        entities=list(result["entities"]),
        clause_boundary=result["clause_boundary"],
        embedding_drift=result["embedding_drift"],
        is_presentation_turn=result["is_presentation_turn"],
    )


@app.post("/rerank", response_model=RerankResponse)
def rerank(req: RerankRequest) -> RerankResponse:
    return RerankResponse(order=_reranker.rerank(req.query, req.candidates))


@app.post("/nli", response_model=NliResponse)
def nli(req: NliRequest) -> NliResponse:
    return NliResponse(entailed=_nli.entails(req.premise, req.hypothesis))
