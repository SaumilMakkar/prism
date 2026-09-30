"""Orchestrator sequencing with every peer service mocked out — proves the
semantic cache (F9) and the evidence payload without ml/vector/ai running.
"""
from __future__ import annotations

from pathlib import Path
from unittest.mock import patch

from prism_core.controller import ChunkFeatures
from prism_core.schemas import Claim, RetrievalHit

from app.claims.store import ClaimGraphStore, InMemoryStore
from app.controller.controller import SessionControllers
from app.orchestrator.orchestrator import Orchestrator
from app.telemetry.telemetry import TelemetryWriter


def _retrieve_features(self, session_id, chunk_index, text):
    return ChunkFeatures(chunk_index=chunk_index, content_tokens=8, entities=("phone",), clause_boundary=True)


def make_orchestrator(tmp_path: Path) -> Orchestrator:
    return Orchestrator(
        SessionControllers("unused"),
        ClaimGraphStore(InMemoryStore()),
        TelemetryWriter(tmp_path / "events.jsonl"),
        vector_service_url="unused",
        ai_service_url="unused",
        ml_service_url="unused",
    )


def hit(doc_id: str = "DOC_1") -> RetrievalHit:
    return RetrievalHit(doc_id=doc_id, section="1.1", text="the device will not power on", score=1.0, source="fused")


def run_turn(orch: Orchestrator, text: str, chunk_index: int, searches: list[str], embed_vector):
    def fake_search(self, query, top_k=5):
        searches.append(query)
        return [hit()]

    def fake_synth(self, session_id, sub_query, evidence):
        claim = Claim(
            claim_id=f"c-{sub_query}",
            text="device does not power on",
            citation_id="DOC_1 §1.1",
            quote="the device will not power on",
        )
        return [claim], "offline"

    with patch.object(SessionControllers, "fetch_features", _retrieve_features), patch.object(
        Orchestrator, "_embed", lambda self, t: embed_vector(t)
    ), patch.object(Orchestrator, "_decompose", lambda self, sid, t: ([t], "offline")), patch.object(
        Orchestrator, "_search", fake_search
    ), patch.object(Orchestrator, "_synthesize", fake_synth), patch.object(
        Orchestrator, "_nli", lambda self, p, h: True
    ):
        return orch.process_chunk("session-1", "hash-1", chunk_index, text)


def test_second_near_duplicate_sub_query_is_served_from_cache(tmp_path):
    orch = make_orchestrator(tmp_path)
    searches: list[str] = []

    def same_vector(_text):
        return [1.0, 0.0, 0.0]  # every sub-query embeds identically

    first = run_turn(orch, "phone will not power on.", 0, searches, same_vector)
    second = run_turn(orch, "phone does not power on at all.", 1, searches, same_vector)

    assert searches == ["phone will not power on."]  # one real search, not two
    assert first["evidence"][0]["cache_hit"] is False
    assert second["evidence"][0]["cache_hit"] is True
    assert second["evidence"][0]["sub_query"] == "phone does not power on at all."

    retrievals = [e for e in orch.telemetry.read_all() if e["event"] == "retrieval_completed"]
    assert [e["cache_hit"] for e in retrievals] == [False, True]
    assert retrievals[1]["cache_similarity"] == 1.0


def test_dissimilar_sub_queries_both_search(tmp_path):
    orch = make_orchestrator(tmp_path)
    searches: list[str] = []
    vectors = {"phone will not power on.": [1.0, 0.0], "is it under warranty?": [0.0, 1.0]}

    run_turn(orch, "phone will not power on.", 0, searches, lambda t: vectors[t])
    run_turn(orch, "is it under warranty?", 1, searches, lambda t: vectors[t])
    assert len(searches) == 2


def test_cache_is_bypassed_when_embedding_fails(tmp_path):
    orch = make_orchestrator(tmp_path)
    searches: list[str] = []
    run_turn(orch, "phone will not power on.", 0, searches, lambda _t: None)
    run_turn(orch, "phone will not power on.", 1, searches, lambda _t: None)
    assert len(searches) == 2


def test_turn_response_carries_evidence_with_citation_ids(tmp_path):
    orch = make_orchestrator(tmp_path)
    resp = run_turn(orch, "phone will not power on.", 0, [], lambda _t: [1.0])
    assert resp["evidence"][0]["citation_id"] == "DOC_1 §1.1"
    assert resp["evidence"][0]["text"] == "the device will not power on"
    assert resp["claims"][0]["status"] == "verified"


def test_no_evidence_turn_records_an_explicit_uncertainty_claim(tmp_path):
    orch = make_orchestrator(tmp_path)

    def fake_synth_empty(self, session_id, sub_query, evidence):
        return [], "offline"

    with patch.object(SessionControllers, "fetch_features", _retrieve_features), patch.object(
        Orchestrator, "_embed", lambda self, t: None
    ), patch.object(Orchestrator, "_decompose", lambda self, sid, t: ([t], "offline")), patch.object(
        Orchestrator, "_search", lambda self, query, top_k=5: [hit()]
    ), patch.object(Orchestrator, "_synthesize", fake_synth_empty):
        resp = orch.process_chunk("session-1", "hash-1", 0, "what's the trade-in value for my old phone?")

    assert len(resp["claims"]) == 1
    claim = resp["claims"][0]
    assert claim["status"] == "uncertainty"
    assert claim["reason_code"] == "NO_EVIDENCE_FOR_SUBQUERY"
    assert claim["sub_intent"] == "what's the trade-in value for my old phone?"


def test_no_evidence_turn_does_not_let_a_prior_unrelated_claim_stand_alone(tmp_path):
    # Real bug: a verified claim from an earlier, unrelated topic (e.g. from
    # the guided tour) stayed in the session's claim graph forever. When the
    # next question was genuinely off-corpus, nothing distinguished "this
    # answers your new question" from "this is leftover from before" - the
    # old claim just kept rendering with no signal it was stale.
    orch = make_orchestrator(tmp_path)

    first = run_turn(orch, "my SmartThings device shows offline.", 0, [], lambda _t: [1.0, 0.0])
    assert first["claims"][0]["status"] == "verified"
    old_claim_id = first["claims"][0]["claim_id"]

    def fake_synth_empty(self, session_id, sub_query, evidence):
        return [], "offline"

    with patch.object(SessionControllers, "fetch_features", _retrieve_features), patch.object(
        Orchestrator, "_embed", lambda self, t: [0.0, 1.0]
    ), patch.object(Orchestrator, "_decompose", lambda self, sid, t: ([t], "offline")), patch.object(
        Orchestrator, "_search", lambda self, query, top_k=5: [hit()]
    ), patch.object(Orchestrator, "_synthesize", fake_synth_empty):
        second = orch.process_chunk(
            "session-1", "hash-1", 1, "what's the trade-in value for my old phone?"
        )

    claim_ids = {c["claim_id"] for c in second["claims"]}
    assert old_claim_id in claim_ids  # the old claim is still there (correct - not fabricated)
    uncertain = [c for c in second["claims"] if c["status"] == "uncertainty"]
    # ...but it is no longer alone: an explicit "no evidence for THIS
    # question" claim exists too, so the dashboard can show both instead of
    # silently presenting the old one as if it answers the new question.
    assert len(uncertain) == 1
    assert uncertain[0]["reason_code"] == "NO_EVIDENCE_FOR_SUBQUERY"


def test_controller_decision_event_records_evaluated_features(tmp_path):
    orch = make_orchestrator(tmp_path)
    run_turn(orch, "phone will not power on.", 0, [], lambda _t: [1.0])
    decision_events = [e for e in orch.telemetry.read_all() if e["event"] == "controller_decision"]
    assert decision_events[0]["features"]["entities"] == ["phone"]
    assert decision_events[0]["features"]["clause_boundary"] is True
