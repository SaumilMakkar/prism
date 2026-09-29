from app.rerank.reranker import LexicalOverlapReranker


def test_rerank_prefers_higher_token_overlap():
    reranker = LexicalOverlapReranker()
    order = reranker.rerank(
        "device will not power on",
        ["SmartThings pairing steps", "the device will not power on at all"],
    )
    assert order[0] == 1


def test_rerank_empty_candidates():
    reranker = LexicalOverlapReranker()
    assert reranker.rerank("query", []) == []
