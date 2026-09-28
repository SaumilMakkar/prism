from app.chunking.chunking import Chunk
from app.search.bm25_index import BM25Index


def make_chunk(doc_id: str, section: str, text: str) -> Chunk:
    return Chunk(
        doc_id=doc_id,
        section=section,
        heading="h",
        text=text,
        doc_title="t",
        version=1,
        effective_date="2026-01-01",
    )


def test_search_ranks_exact_term_match_first():
    chunks = [
        make_chunk("A", "1", "the device will not power on at all"),
        make_chunk("B", "1", "SmartThings pairing instructions for a new bulb"),
    ]
    index = BM25Index(chunks)
    results = index.search("device power on", top_n=2)
    assert results[0] == "A §1"


def test_empty_corpus_returns_empty():
    index = BM25Index([])
    assert index.search("anything") == []
