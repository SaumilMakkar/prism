"""Section-aware chunking — ADR-0002.

Splits a frontmatter markdown doc on H3 (###) sections nested under H2
groups, keeping the numeric section id (e.g. "2.1") so citation ids stay
stable across corpus versions: the id comes from document structure, not
from a byte offset that shifts when text is edited.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import frontmatter

SECTION_RE = re.compile(r"^###\s+([0-9]+(?:\.[0-9]+)*)\s+(.*)$")


@dataclass
class Chunk:
    doc_id: str
    section: str
    heading: str
    text: str
    doc_title: str
    version: int
    effective_date: str
    status: str = "current"

    @property
    def citation_id(self) -> str:
        return f"{self.doc_id} §{self.section}"

    @property
    def chunk_id(self) -> str:
        return self.citation_id


def chunk_markdown_file(path: Path) -> list[Chunk]:
    post = frontmatter.load(path)
    meta = post.metadata
    doc_id = meta.get("doc_id", path.stem)
    title = meta.get("title", path.stem)
    version = int(meta.get("version", 1))
    effective_date = str(meta.get("effective_date", ""))
    status = meta.get("status", "current")

    lines = post.content.splitlines()
    chunks: list[Chunk] = []
    current_section: str | None = None
    current_heading = ""
    buffer: list[str] = []

    def flush() -> None:
        if current_section is not None and buffer:
            text = "\n".join(buffer).strip()
            if text:
                chunks.append(
                    Chunk(
                        doc_id=doc_id,
                        section=current_section,
                        heading=current_heading,
                        text=text,
                        doc_title=title,
                        version=version,
                        effective_date=effective_date,
                        status=status,
                    )
                )

    for line in lines:
        match = SECTION_RE.match(line.strip())
        if match:
            flush()
            current_section, current_heading = match.group(1), match.group(2)
            buffer = []
        elif current_section is not None:
            buffer.append(line)
    flush()

    return chunks


def chunk_corpus(corpus_dir: Path) -> list[Chunk]:
    chunks: list[Chunk] = []
    for path in sorted(corpus_dir.rglob("*.md")):
        chunks.extend(chunk_markdown_file(path))
    return chunks
