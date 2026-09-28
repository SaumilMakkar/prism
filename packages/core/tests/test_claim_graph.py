from prism_core.claim_graph import SessionClaimGraph
from prism_core.schemas import Claim, ClaimStatus


def make_claim(claim_id: str, text: str) -> Claim:
    return Claim(
        claim_id=claim_id,
        text=text,
        citation_id="KB_012 §2.1",
        quote="the device will not power on",
        status=ClaimStatus.VERIFIED,
    )


def test_new_claims_are_all_added():
    graph = SessionClaimGraph(session_id_hash="abc")
    diff = graph.upsert([make_claim("c1", "text1"), make_claim("c2", "text2")])
    assert set(diff.added) == {"c1", "c2"}
    assert diff.superseded == []
    assert diff.unchanged == []


def test_refinement_marks_superseded_and_preserves_untouched_claims():
    graph = SessionClaimGraph(session_id_hash="abc")
    graph.upsert([make_claim("c1", "original"), make_claim("c2", "untouched")])

    diff = graph.upsert([make_claim("c1", "refined with new detail")])

    assert diff.added == ["c1"]
    assert diff.superseded == ["c1"]
    assert diff.unchanged == ["c2"]

    rendered = {c.claim_id: c for c in graph.render()}
    assert rendered["c1"].text == "refined with new detail"
    assert rendered["c1"].version == 2
    assert rendered["c2"].version == 1


def test_render_is_zero_cost_readback():
    graph = SessionClaimGraph(session_id_hash="abc")
    graph.upsert([make_claim("c1", "text1")])
    first_render = graph.render()
    second_render = graph.render()
    assert [c.claim_id for c in first_render] == [c.claim_id for c in second_render]
