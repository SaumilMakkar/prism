from pathlib import Path

from app.ingest.ingest import ingest_corpus

CORPUS_DIR = Path(__file__).resolve().parents[3] / "corpus"


def test_superseded_chunks_are_excluded_from_the_index():
    chunks, bm25 = ingest_corpus(CORPUS_DIR, embed_fn=lambda texts: [[0.0]] * len(texts))
    statuses = {c.status for c in chunks}
    assert "superseded" not in statuses


def test_no_duplicate_citation_ids_reach_the_index():
    # A duplicate id in the indexed chunk list would make BM25/RRF
    # double-count it (see ingest.py) and make id -> chunk lookup
    # ambiguous for the verifier (ADR-0005).
    chunks, _ = ingest_corpus(CORPUS_DIR, embed_fn=lambda texts: [[0.0]] * len(texts))
    citation_ids = [c.citation_id for c in chunks]
    assert len(citation_ids) == len(set(citation_ids))


def test_current_policy_version_is_still_indexed():
    chunks, _ = ingest_corpus(CORPUS_DIR, embed_fn=lambda texts: [[0.0]] * len(texts))
    current_pol_sections = {c.section for c in chunks if c.doc_id == "POL_004"}
    assert current_pol_sections == {"4.1", "4.2", "5.1", "5.2"}
