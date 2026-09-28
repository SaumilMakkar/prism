"""Loads labelled evaluation streams — evaluation/README.md.

No eval query, answer, or Doc_ID from these files may ever be copied into
`services/`; CI's hardcode-grep job checks that boundary on every push
(SECURITY.md T8).
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

STREAMS_DIR = Path(__file__).resolve().parents[1] / "streams"


@dataclass
class Stream:
    stream_id: str
    category: str
    chunks: list[str]
    expected_safe_chunk_index: int | None = None
    expected_uncertain: bool = False
    expected_min_subintents: int = 1
    expected_relevant_doc_ids: list[str] | None = None
    adversarial_doc_id: str | None = None


def load_streams(categories: list[str] | None = None) -> list[Stream]:
    streams: list[Stream] = []
    for category_dir in sorted(STREAMS_DIR.iterdir()):
        if not category_dir.is_dir():
            continue
        if categories and category_dir.name not in categories:
            continue
        for path in sorted(category_dir.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            streams.append(
                Stream(
                    stream_id=path.stem,
                    category=category_dir.name,
                    chunks=data["chunks"],
                    expected_safe_chunk_index=data.get("expected_safe_chunk_index"),
                    expected_uncertain=data.get("expected_uncertain", False),
                    expected_min_subintents=data.get("expected_min_subintents", 1),
                    expected_relevant_doc_ids=data.get("expected_relevant_doc_ids"),
                    adversarial_doc_id=data.get("adversarial_doc_id"),
                )
            )
    return streams
