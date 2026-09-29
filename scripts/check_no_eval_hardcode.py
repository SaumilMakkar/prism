"""Fail if any eval-stream content appears under services/ (CLAUDE.md rule 2,
SECURITY.md T8).

The rule this enforces: nothing the engine does may be tuned to the
benchmark. So every query chunk from `evaluation/streams/**/*.json`, plus
the adversarial document id those streams name, is a forbidden literal in
`services/` — source *and* tests, since a fixture copied from a stream is
exactly how "it works on the eval" gets hardcoded by accident.

What is deliberately NOT forbidden: ids of documents that exist in the
committed demo `corpus/` (KB_012, POL_004, ...). Those are public fixture
data the services must be able to ingest and cite, and the streams'
`expected_relevant_doc_ids` merely point at them. The adversarial id is
the exception because it exists only to test injection handling.

Matching is normalised (lower-case, whitespace collapsed, trailing
punctuation stripped) so a fixture that differs from a stream only by
capitalisation or a comma still fails. Run locally with `make lint`.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STREAMS = ROOT / "evaluation" / "streams"
SERVICES = ROOT / "services"

SCAN_SUFFIXES = {".py", ".ts", ".tsx", ".js", ".json", ".md", ".txt", ".yml", ".yaml", ".html", ".css"}
SKIP_DIRS = {"node_modules", "dist", "__pycache__", ".pytest_cache", ".vite"}
MIN_WORDS = 3  # shorter fragments ("my phone") are ordinary English, not eval content

_WS = re.compile(r"\s+")


def normalise(text: str) -> str:
    return _WS.sub(" ", text.strip().lower()).rstrip(" .,!?;:")


def forbidden_literals() -> tuple[set[str], set[str]]:
    chunks: set[str] = set()
    doc_ids: set[str] = set()
    for path in sorted(STREAMS.rglob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for chunk in data.get("chunks", []):
            norm = normalise(chunk)
            if len(norm.split()) >= MIN_WORDS:
                chunks.add(norm)
        for key in ("expected_answer", "expected_answers"):
            values = data.get(key, [])
            for value in [values] if isinstance(values, str) else values:
                norm = normalise(value)
                if len(norm.split()) >= MIN_WORDS:
                    chunks.add(norm)
        if data.get("adversarial_doc_id"):
            doc_ids.add(data["adversarial_doc_id"])
    return chunks, doc_ids


def scan_files():
    for path in SERVICES.rglob("*"):
        if not path.is_file() or path.suffix not in SCAN_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        yield path


def main() -> int:
    chunks, doc_ids = forbidden_literals()
    if not chunks and not doc_ids:
        print("No eval streams found — nothing to check.")
        return 0

    violations: list[tuple[Path, int, str]] = []
    for path in scan_files():
        try:
            lines = path.read_text(encoding="utf-8").splitlines()
        except UnicodeDecodeError:
            continue
        for lineno, line in enumerate(lines, start=1):
            norm_line = normalise(line)
            for chunk in chunks:
                if chunk in norm_line:
                    violations.append((path, lineno, f"eval query text: {chunk!r}"))
            for doc_id in doc_ids:
                if doc_id in line:
                    violations.append((path, lineno, f"adversarial doc id: {doc_id}"))

    if violations:
        print("Hardcoded eval content found under services/ -- disqualifying per the guide:")
        for path, lineno, why in violations:
            print(f"  {path.relative_to(ROOT).as_posix()}:{lineno}: {why}")
        return 1

    print(
        f"OK -- {len(chunks)} eval query fragments and {len(doc_ids)} adversarial doc id(s) "
        f"checked; none appear under services/."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
