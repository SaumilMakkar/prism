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


class FakeClockStore:
    """InMemoryStore that honours `ex` against an injectable clock, so the
    30-minute TTL the schema promises (SECURITY.md T6) is proven by a test
    rather than asserted — without waiting 30 minutes or running Redis."""

    def __init__(self) -> None:
        self.now = 0.0
        self._data: dict[str, tuple[str, float]] = {}

    def get(self, key: str) -> bytes | None:
        item = self._data.get(key)
        if item is None:
            return None
        value, expires_at = item
        if self.now >= expires_at:
            del self._data[key]
            return None
        return value.encode("utf-8")

    def set(self, key: str, value: str, ex: int) -> None:
        self._data[key] = (value, self.now + ex)

    def delete(self, key: str) -> None:
        self._data.pop(key, None)


def test_session_expires_after_ttl_and_nothing_survives():
    from app.claims import store as store_module

    clock = FakeClockStore()
    store = ClaimGraphStore(clock)
    store.upsert("hash1", [make_claim("c1", "text1")])

    clock.now = store_module.SESSION_TTL_SECONDS - 1
    assert [c.claim_id for c in store.render("hash1")] == ["c1"]

    clock.now = store_module.SESSION_TTL_SECONDS
    assert store.render("hash1") == []


def test_every_write_uses_the_configured_ttl():
    from app.claims import store as store_module

    class RecordingStore(InMemoryStore):
        def __init__(self) -> None:
            super().__init__()
            self.ttls: list[int] = []

        def set(self, key: str, value: str, ex: int) -> None:
            self.ttls.append(ex)
            super().set(key, value, ex)

    recording = RecordingStore()
    store = ClaimGraphStore(recording)
    store.upsert("hash1", [make_claim("c1", "a")])
    store.upsert("hash1", [make_claim("c2", "b")])
    assert recording.ttls == [store_module.SESSION_TTL_SECONDS] * 2
