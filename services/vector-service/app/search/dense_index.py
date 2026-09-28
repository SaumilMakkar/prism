"""Dense index over Qdrant. Embeddings are computed by ml-service; this
module only owns the Qdrant collection and similarity search, per the
ADR-0001 boundary (vector-service does not own embedding).
"""
from __future__ import annotations

from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels

from app.chunking.chunking import Chunk

COLLECTION = "prelude_chunks"


class DenseIndex:
    def __init__(self, client: QdrantClient, vector_size: int) -> None:
        self.client = client
        self.vector_size = vector_size
        self._ensure_collection()

    def _ensure_collection(self) -> None:
        existing = [c.name for c in self.client.get_collections().collections]
        if COLLECTION not in existing:
            self.client.create_collection(
                collection_name=COLLECTION,
                vectors_config=qmodels.VectorParams(
                    size=self.vector_size, distance=qmodels.Distance.COSINE
                ),
            )

    def upsert(self, chunks: list[Chunk], vectors: list[list[float]]) -> None:
        points = [
            qmodels.PointStruct(
                id=i,
                vector=vectors[i],
                payload={"chunk_id": chunk.chunk_id},
            )
            for i, chunk in enumerate(chunks)
        ]
        if points:
            self.client.upsert(collection_name=COLLECTION, points=points)

    def search(self, query_vector: list[float], top_n: int = 10) -> list[str]:
        hits = self.client.search(
            collection_name=COLLECTION, query_vector=query_vector, limit=top_n
        )
        return [hit.payload["chunk_id"] for hit in hits]
