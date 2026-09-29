"""Multi-Intent Decomposer — F2. One small-model call, strict JSON, cap 4,
merge near-duplicates, carries session entities. The JSON contract and cap
are enforced here regardless of what the model actually returns, so a
malformed or over-long model response can never violate the contract
downstream.
"""
from __future__ import annotations

import json
from difflib import SequenceMatcher

from app.replay.replay import ReplayingProvider

MAX_SUB_QUERIES = 4
DUPLICATE_SIMILARITY_THRESHOLD = 0.85

SYSTEM_TEMPLATE = (
    "You split a support-agent's live transcript fragment into at most 4 "
    "independent sub-questions. Return strict JSON: "
    '{{"sub_queries": ["...", "..."]}}. '
    "Known entities already established in this session: {session_entities}"
)


def _merge_near_duplicates(sub_queries: list[str]) -> list[str]:
    merged: list[str] = []
    for q in sub_queries:
        if not any(
            SequenceMatcher(None, q.lower(), existing.lower()).ratio()
            >= DUPLICATE_SIMILARITY_THRESHOLD
            for existing in merged
        ):
            merged.append(q)
    return merged


def parse_decompose_response(raw: str, fallback_text: str) -> list[str]:
    try:
        data = json.loads(raw)
        sub_queries = [str(q).strip() for q in data.get("sub_queries", []) if str(q).strip()]
    except (json.JSONDecodeError, AttributeError, TypeError):
        sub_queries = []

    if not sub_queries:
        sub_queries = [fallback_text.strip()]

    sub_queries = _merge_near_duplicates(sub_queries)
    return sub_queries[:MAX_SUB_QUERIES]


def decompose(
    text: str,
    session_entities: list[str],
    replaying_provider: ReplayingProvider,
    model: str,
) -> tuple[list[str], str]:
    system = SYSTEM_TEMPLATE.format(session_entities=", ".join(session_entities) or "(none)")
    raw, source = replaying_provider.complete(system, text, model)
    return parse_decompose_response(raw, fallback_text=text), source
