from app.synthesize.synthesize import parse_synthesize_response


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
