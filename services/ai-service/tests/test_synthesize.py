from prism_core.schemas import RetrievalHit

from app.synthesize.synthesize import _format_evidence, parse_synthesize_response


def test_parses_claims_with_citation_and_quote():
    raw = (
        '{"claims": [{"text": "Wait 10 minutes before power on.", '
        '"citation_id": "KB_012 §2.1", "quote": "wait 10 minutes"}]}'
    )
    claims = parse_synthesize_response(raw, sub_intent="power issue")
    assert len(claims) == 1
    assert claims[0].citation_id == "KB_012 §2.1"
    assert claims[0].status.value == "uncertainty"  # verification happens in gateway, not here


def test_empty_claims_on_no_evidence():
    raw = '{"claims": []}'
    claims = parse_synthesize_response(raw, sub_intent="off-corpus question")
    assert claims == []


def test_malformed_json_yields_no_claims_rather_than_guessing():
    claims = parse_synthesize_response("garbage output", sub_intent="anything")
    assert claims == []


def test_claim_without_text_is_skipped():
    raw = '{"claims": [{"text": "", "citation_id": "KB_012 §2.1", "quote": "x"}]}'
    claims = parse_synthesize_response(raw, sub_intent="x")
    assert claims == []


def test_format_evidence_includes_heading_when_present():
    # A real gap this closed: the heading often carries phrasing the body
    # never repeats verbatim, and it was being silently dropped before
    # ever reaching the LLM (or the offline fallback).
    hit = RetrievalHit(doc_id="KB_012", section="2.2", text="A boot loop is caused by...", score=1.0, source="fused", heading="Device restarts repeatedly")
    formatted = _format_evidence([hit])
    assert "Heading: Device restarts repeatedly" in formatted
    assert "A boot loop is caused by..." in formatted


def test_format_evidence_omits_heading_line_when_none():
    hit = RetrievalHit(doc_id="KB_012", section="2.2", text="A boot loop is caused by...", score=1.0, source="fused")
    formatted = _format_evidence([hit])
    assert "Heading:" not in formatted
