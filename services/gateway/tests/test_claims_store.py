from prism_core.schemas import Claim, ClaimStatus

from app.claims.store import ClaimGraphStore, InMemoryStore


def make_claim(claim_id: str, text: str) -> Claim:
    return Claim(claim_id=claim_id, text=text, status=ClaimStatus.VERIFIED)


def test_upsert_and_render_round_trips_through_store():
    store = ClaimGraphStore(InMemoryStore())
    store.upsert("hash1", [make_claim("c1", "text1")])
    rendered = store.render("hash1")
    assert len(rendered) == 1
    assert rendered[0].claim_id == "c1"


def test_refinement_persists_across_load_save_cycles():
    store = ClaimGraphStore(InMemoryStore())
    store.upsert("hash1", [make_claim("c1", "original"), make_claim("c2", "other")])
    diff = store.upsert("hash1", [make_claim("c1", "refined")])
    assert diff.superseded == ["c1"]
    assert diff.unchanged == ["c2"]

    rendered = {c.claim_id: c for c in store.render("hash1")}
    assert rendered["c1"].text == "refined"
    assert rendered["c1"].version == 2


def test_sessions_are_isolated_by_hash():
    store = ClaimGraphStore(InMemoryStore())
    store.upsert("hashA", [make_claim("c1", "a-text")])
    store.upsert("hashB", [make_claim("c1", "b-text")])
    assert store.render("hashA")[0].text == "a-text"
    assert store.render("hashB")[0].text == "b-text"


def test_expire_now_clears_session():
    store = ClaimGraphStore(InMemoryStore())
    store.upsert("hash1", [make_claim("c1", "text1")])
    store.expire_now("hash1")
    assert store.render("hash1") == []
