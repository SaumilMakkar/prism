from prism_core.fusion import reciprocal_rank_fusion


def test_agreement_across_lists_outranks_single_list_top_hit():
    bm25 = ["docA", "docB", "docC"]
    dense = ["docB", "docA", "docD"]
    fused = reciprocal_rank_fusion([bm25, dense])
    fused_ids = [item_id for item_id, _ in fused]
    # docA and docB both appear near the top of both lists; docC/docD only
    # appear once each, so the two agreed-upon docs must lead.
    assert set(fused_ids[:2]) == {"docA", "docB"}


def test_single_list_is_returned_in_order():
    fused = reciprocal_rank_fusion([["x", "y", "z"]])
    assert [item_id for item_id, _ in fused] == ["x", "y", "z"]


def test_empty_lists_produce_empty_result():
    assert reciprocal_rank_fusion([[], []]) == []


def test_scores_are_monotonically_non_increasing():
    fused = reciprocal_rank_fusion([["a", "b", "c"], ["c", "b", "a"]])
    scores = [score for _, score in fused]
    assert scores == sorted(scores, reverse=True)
