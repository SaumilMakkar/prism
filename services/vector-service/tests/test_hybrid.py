from app.search.hybrid import hybrid_rank


def test_hybrid_combines_bm25_and_dense():
    bm25 = ["a", "b", "c"]
    dense = ["b", "a", "d"]
    result = hybrid_rank(bm25, dense, hybrid_enabled=True, top_k=2)
    assert set(result) == {"a", "b"}


def test_dense_only_ablation_ignores_bm25():
    bm25 = ["x", "y", "z"]
    dense = ["d1", "d2", "d3"]
    result = hybrid_rank(bm25, dense, hybrid_enabled=False, top_k=2)
    assert result == ["d1", "d2"]


def test_dedupes_repeated_ids():
    result = hybrid_rank(["a", "a", "b"], ["a", "c"], hybrid_enabled=True, top_k=5)
    assert len(result) == len(set(result))
