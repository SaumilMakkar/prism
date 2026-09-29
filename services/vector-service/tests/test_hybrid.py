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


def test_detailed_ranking_carries_bm25_and_dense_ranks():
    from app.search.hybrid import hybrid_rank_detailed

    ranked = hybrid_rank_detailed(["a", "b"], ["b", "c"], hybrid_enabled=True, top_k=3)
    by_id = {r.chunk_id: r for r in ranked}
    assert by_id["b"].bm25_rank == 2 and by_id["b"].dense_rank == 1
    assert by_id["a"].bm25_rank == 1 and by_id["a"].dense_rank is None
    assert by_id["c"].bm25_rank is None and by_id["c"].dense_rank == 2
    # agreement across both lists wins, and the RRF score is real, not None
    assert ranked[0].chunk_id == "b" and ranked[0].rrf_score is not None


def test_detailed_dense_only_has_no_rrf_score():
    from app.search.hybrid import hybrid_rank_detailed

    ranked = hybrid_rank_detailed(["x"], ["d1", "d2"], hybrid_enabled=False, top_k=5)
    assert [r.chunk_id for r in ranked] == ["d1", "d2"]
    assert all(r.rrf_score is None for r in ranked)
