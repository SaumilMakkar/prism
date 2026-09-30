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


def test_synthesize_does_not_confuse_unrelated_chunks_via_contraction_fragments():
    # Real bug: "won't" used to tokenize as two words, "won" and "t" — a
    # bare "t" (and "won") then spuriously matched ANY other chunk whose
    # heading also happened to contain a contraction, even on a completely
    # different topic. "My phone won't power on" was matching a
    # screen-touch chunk ("Screen won't respond to touch") ahead of the
    # actually-correct power-on chunk purely because both contain "won't".
    provider = OfflineProvider()
    user = (
        "Evidence:\n[KB_012 §2.1]\nHeading: Device will not power on\n"
        "If the device will not power on, connect the original charger and cable and wait 10 minutes "
        "before attempting to power on — some units require a minimum charge threshold before the "
        "power-on sequence will complete. If the device still will not power on after 10 minutes of "
        "charging, hold Power and Volume Down for 15 seconds to force a hardware reset. If there is "
        "still no response, the battery or power IC may have failed and the device should be taken to "
        "an authorized service centre.\n\n"
        "[KB_012 §1.1]\nHeading: Screen won't respond to touch\n"
        "If the screen does not respond to touch, first perform a soft restart by holding the Power "
        "and Volume Down buttons for 10 seconds. If the device does not restart, connect it to a "
        "charger for 15 minutes and try again — a fully drained battery can appear as an "
        "unresponsive screen.\n\n"
        "Question: my phone won't power on, what should I do"
    )
    raw = provider.complete(SYNTHESIZE_SYSTEM, user, "offline-model")
    claims = parse_synthesize_response(raw, sub_intent="power on")
    assert len(claims) == 1
    assert claims[0].citation_id == "KB_012 §2.1"


def test_synthesize_uses_heading_to_find_a_match_the_body_alone_would_miss():
    # Real bug found via evaluation/streams/simple/simple_boot_loop.json:
    # the chunk body never says "restarts repeatedly" — that phrasing only
    # exists in the markdown heading ("Device powers on but restarts
    # repeatedly (boot loop)"). Without folding the heading into relevance
    # scoring, this legitimate match was rejected as off-topic.
    provider = OfflineProvider()
    user = (
        "Evidence:\n[KB_012 §2.2]\nHeading: Device powers on but restarts repeatedly (boot loop)\n"
        "A boot loop is most commonly caused by a corrupted software update. Boot into Safe Mode by "
        "holding Volume Down during the Samsung logo screen.\n\n"
        "Question: my phone powers on but restarts repeatedly in a boot loop"
    )
    raw = provider.complete(SYNTHESIZE_SYSTEM, user, "offline-model")
    claims = parse_synthesize_response(raw, sub_intent="boot loop")
    assert len(claims) == 1
    assert claims[0].citation_id == "KB_012 §2.2"
    # The quote must stay a real substring of the BODY — never the heading,
    # since the heading text was never sent to vector-service as chunk text
    # and would fail the verifier's quote-match check.
    assert "Heading:" not in claims[0].quote
    assert claims[0].quote in (
        "A boot loop is most commonly caused by a corrupted software update. Boot into Safe Mode by "
        "holding Volume Down during the Samsung logo screen."
    )


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
