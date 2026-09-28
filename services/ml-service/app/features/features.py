"""Per-chunk feature extraction feeding the controller — ADR-0003.

Entities via spaCy (loaded lazily); drift and clause-boundary/content-token
features are pure text/vector math so they stay unit-testable without spaCy
installed.
"""
from __future__ import annotations

import math
import re
from typing import Iterable

CLAUSE_END_RE = re.compile(r"[.!?,;]\s*$")
PRESENTATION_PHRASES = (
    "say that again",
    "shorter",
    "repeat that",
    "tl;dr",
    "summarize",
    "make it shorter",
)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if not a or not b:
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a)) or 1.0
    norm_b = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (norm_a * norm_b)


def embedding_drift(prev_vector: list[float] | None, curr_vector: list[float]) -> float:
    """1 - cosine similarity between successive buffer embeddings; 0 if no
    previous buffer exists yet (first chunk in a session)."""
    if prev_vector is None:
        return 0.0
    return max(0.0, 1.0 - cosine_similarity(prev_vector, curr_vector))


def content_token_count(text: str) -> int:
    return len([t for t in text.strip().split() if t.isalnum() or any(c.isalnum() for c in t)])


def has_clause_boundary(text: str) -> bool:
    return bool(CLAUSE_END_RE.search(text.strip()))


def is_presentation_turn(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in PRESENTATION_PHRASES)


_NLP = None


def _get_nlp():
    global _NLP
    if _NLP is None:
        import spacy

        try:
            _NLP = spacy.load("en_core_web_sm")
        except OSError:
            _NLP = spacy.blank("en")
    return _NLP


def extract_entities(text: str) -> tuple[str, ...]:
    nlp = _get_nlp()
    doc = nlp(text)
    ents = getattr(doc, "ents", ())
    if ents:
        return tuple(ent.text for ent in ents)
    # spacy.blank has no NER pipe; fall back to capitalized-token heuristic
    # so the feature is never silently empty in a minimal environment.
    return tuple(
        tok for tok in text.split() if tok[:1].isupper() and len(tok) > 2
    )


def extract_all(
    text: str,
    prev_vector: list[float] | None,
    curr_vector: list[float],
) -> dict:
    return {
        "entities": extract_entities(text),
        "content_tokens": content_token_count(text),
        "clause_boundary": has_clause_boundary(text),
        "embedding_drift": embedding_drift(prev_vector, curr_vector),
        "is_presentation_turn": is_presentation_turn(text),
    }
