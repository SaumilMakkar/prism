from pathlib import Path

from app.chunking.chunking import chunk_markdown_file

CORPUS_DIR = Path(__file__).resolve().parents[3] / "corpus"


def test_chunks_have_stable_citation_ids():
    chunks = chunk_markdown_file(CORPUS_DIR / "KB_012_galaxy_troubleshooting.md")
    citation_ids = [c.citation_id for c in chunks]
    assert "KB_012 §2.1" in citation_ids


def test_section_text_does_not_bleed_into_next_section():
    chunks = chunk_markdown_file(CORPUS_DIR / "KB_012_galaxy_troubleshooting.md")
    section_21 = next(c for c in chunks if c.section == "2.1")
    assert "boot loop" not in section_21.text.lower()


def test_superseded_and_current_policy_versions_are_distinguishable():
    v1 = chunk_markdown_file(CORPUS_DIR / "POL_004_warranty_return_v1.md")
    v2 = chunk_markdown_file(CORPUS_DIR / "POL_004_warranty_return_v2.md")
    assert v1[0].status == "superseded"
    assert v2[0].status == "current"
    assert v1[0].doc_id == v2[0].doc_id == "POL_004"
