"""bge-small embedding — ADR-0002 / prelude.md Section 1 (on-device-sized model).

Lazily loaded so importing this module (e.g. for unit tests of other pieces
of ml-service) never triggers a model download.
"""
from __future__ import annotations

from typing import Protocol

MODEL_NAME = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384


class Embedder(Protocol):
    def encode(self, texts: list[str]) -> list[list[float]]: ...


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str = MODEL_NAME) -> None:
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)

    def encode(self, texts: list[str]) -> list[list[float]]:
        vectors = self._model.encode(texts, normalize_embeddings=True)
        return [v.tolist() for v in vectors]


class DeterministicHashEmbedder:
    """Zero-dependency fallback used in unit tests and offline dev so the
    rest of the pipeline (fusion, verifier, dashboard) can be exercised
    without a multi-hundred-MB model download. Never used in `live`/`demo`
    profiles — see docker-compose.yml EMBEDDER_BACKEND.
    """

    def __init__(self, dim: int = EMBEDDING_DIM) -> None:
        self.dim = dim

    def encode(self, texts: list[str]) -> list[list[float]]:
        import hashlib
        import math

        vectors = []
        for text in texts:
            vec = [0.0] * self.dim
            for token in text.lower().split():
                digest = hashlib.sha256(token.encode("utf-8")).digest()
                idx = int.from_bytes(digest[:4], "big") % self.dim
                vec[idx] += 1.0
            norm = math.sqrt(sum(v * v for v in vec)) or 1.0
            vectors.append([v / norm for v in vec])
        return vectors
