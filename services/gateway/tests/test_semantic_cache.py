from prism_core.schemas import RetrievalHit

from app.cache.semantic_cache import SessionSemanticCache, cosine_similarity


def make_hit(doc_id: str = "DOC_1", section: str = "1.1") -> RetrievalHit:
    return RetrievalHit(doc_id=doc_id, section=section, text="some chunk text", score=1.0, source="fused")


def test_cosine_of_identical_vectors_is_one():
    assert abs(cosine_similarity([1.0, 2.0, 3.0], [1.0, 2.0, 3.0]) - 1.0) < 1e-9


def test_cosine_of_orthogonal_vectors_is_zero():
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == 0.0


def test_lookup_misses_on_empty_session():
    cache = SessionSemanticCache()
    assert cache.lookup("s1", [1.0, 0.0]) is None


def test_near_duplicate_sub_query_hits_within_the_same_session():
    cache = SessionSemanticCache(threshold=0.9)
    cache.store("s1", "why is charging slow", [1.0, 0.0, 0.0], [make_hit()])
    found = cache.lookup("s1", [0.98, 0.1, 0.0])
    assert found is not None
    assert found.entry.sub_query == "why is charging slow"
    assert found.similarity >= 0.9
    assert [h.citation_id for h in found.entry.hits] == ["DOC_1 §1.1"]


def test_dissimilar_sub_query_misses():
    cache = SessionSemanticCache(threshold=0.9)
    cache.store("s1", "why is charging slow", [1.0, 0.0, 0.0], [make_hit()])
    assert cache.lookup("s1", [0.0, 1.0, 0.0]) is None


def test_cache_never_crosses_sessions():
    # SECURITY.md T7: session id is the sole key; another session with an
    # identical query must not see this session's hits.
    cache = SessionSemanticCache()
    cache.store("session-A", "q", [1.0, 0.0], [make_hit()])
    assert cache.lookup("session-B", [1.0, 0.0]) is None


def test_best_of_several_entries_is_returned():
    cache = SessionSemanticCache(threshold=0.5)
    cache.store("s1", "first", [1.0, 0.0], [make_hit("A")])
    cache.store("s1", "second", [0.7, 0.7], [make_hit("B")])
    found = cache.lookup("s1", [0.6, 0.8])
    assert found is not None and found.entry.sub_query == "second"


def test_entries_are_bounded_per_session():
    cache = SessionSemanticCache(max_entries_per_session=2)
    for i in range(5):
        cache.store("s1", f"q{i}", [float(i), 1.0], [make_hit()])
    assert cache.size("s1") == 2


def test_clear_drops_only_that_session():
    cache = SessionSemanticCache()
    cache.store("s1", "q", [1.0, 0.0], [make_hit()])
    cache.store("s2", "q", [1.0, 0.0], [make_hit()])
    cache.clear("s1")
    assert cache.lookup("s1", [1.0, 0.0]) is None
    assert cache.lookup("s2", [1.0, 0.0]) is not None
