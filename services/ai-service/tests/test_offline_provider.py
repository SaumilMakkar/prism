import json

from app.decompose.decompose import parse_decompose_response
from app.providers.offline_provider import OfflineProvider
from app.synthesize.synthesize import parse_synthesize_response

DECOMPOSE_SYSTEM = (
    'You split a support-agent\'s live transcript fragment into at most 4 '
    'independent sub-questions. Return strict JSON: {"sub_queries": ["...", "..."]}. '
    "Known entities already established in this session: (none)"
)

SYNTHESIZE_SYSTEM = (
    'You answer using ONLY the evidence chunks provided. Return strict JSON: '
    '{"claims": [{"text": "...", "citation_id": "Doc_ID §Section", "quote": "verbatim substring"}]}. '
    "citation_id must be one of: KB_012 §2.1. quote must be an exact substring of the cited chunk."
)


def test_decompose_splits_compound_question_into_multiple_sub_queries():
    provider = OfflineProvider()
    raw = provider.complete(
        DECOMPOSE_SYSTEM,
        "My tablet screen flickers and the battery drains fast, can I get it repaired and is there a fee for that?",
        "offline-model",
    )
    sub_queries = parse_decompose_response(raw, fallback_text="unused")
    assert 1 < len(sub_queries) <= 4


def test_decompose_drops_bare_filler_fragment():
    provider = OfflineProvider()
    raw = provider.complete(
        DECOMPOSE_SYSTEM, "Oh, and I dropped it last week, does that matter?", "offline-model"
    )
    sub_queries = parse_decompose_response(raw, fallback_text="unused")
    assert all(q.lower().strip("?") != "oh" for q in sub_queries)


def test_decompose_returns_single_sub_query_for_simple_input():
    provider = OfflineProvider()
    raw = provider.complete(DECOMPOSE_SYSTEM, "my phone will not power on", "offline-model")
    sub_queries = parse_decompose_response(raw, fallback_text="unused")
    assert len(sub_queries) == 1


def test_synthesize_grounds_claim_in_most_relevant_evidence_chunk():
    provider = OfflineProvider()
    user = (
        "Evidence:\n[KB_012 §2.1]\nthe device will not power on at all. connect the "
        "original charger and wait 10 minutes.\n\n[KB_030 §6.1]\nsign in with the same "
        "samsung account to sync devices.\n\nQuestion: my phone will not power on"
    )
    raw = provider.complete(SYNTHESIZE_SYSTEM, user, "offline-model")
    claims = parse_synthesize_response(raw, sub_intent="power")
    assert len(claims) == 1
    assert claims[0].citation_id == "KB_012 §2.1"
    assert claims[0].quote in "the device will not power on at all. connect the original charger and wait 10 minutes."


def test_synthesize_returns_no_claims_when_no_evidence_relates_to_question():
    provider = OfflineProvider()
    user = (
        "Evidence:\n[KB_030 §6.1]\nsign in with the same samsung account to sync "
        "devices.\n\nQuestion: what is the refund window for a defective unit"
    )
    raw = provider.complete(SYNTHESIZE_SYSTEM, user, "offline-model")
    data = json.loads(raw)
    assert data["claims"] == []


def test_synthesize_rejects_chunk_with_only_incidental_word_overlap():
    # A chunk about repair-SLA turnaround time that happens to mention
    # "speaker" must not be treated as answering a question about the cost
    # of replacing a speaker grille — one shared word out of six content
    # words is topical proximity, not an answer. This was a real false
    # positive caught by an end-to-end run over the no_evidence eval
    # stream; the fixture here is a synthetic analogue, never the stream's
    # own text (CLAUDE.md rule 2).
    provider = OfflineProvider()
    user = (
        "Evidence:\n[SLA_001 §8.2]\nRepairs requiring a motherboard or speaker "
        "module replacement are completed within 7 business days, subject to parts "
        "availability.\n\nQuestion: what would replacing the speaker grille cost specifically"
    )
    raw = provider.complete(SYNTHESIZE_SYSTEM, user, "offline-model")
    data = json.loads(raw)
    assert data["claims"] == []


def test_synthesize_with_no_evidence_block_returns_no_claims():
    provider = OfflineProvider()
    raw = provider.complete(SYNTHESIZE_SYSTEM, "Evidence:\n\nQuestion: anything", "offline-model")
    data = json.loads(raw)
    assert data["claims"] == []
