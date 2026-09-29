import json

import httpx

from adapter import PreludeClient, render_answer


def fake_gateway(request: httpx.Request) -> httpx.Response:
    path = request.url.path
    if path == "/api/session/start":
        return httpx.Response(200, json={"session_id": "s1", "token": "tok"})
    if path.startswith("/api/turn/"):
        body = json.loads(request.content)
        assert path.endswith("/tok")
        return httpx.Response(
            200,
            json={
                "trace_id": "t1",
                "decision": "retrieve",
                "reason_code": "ENTITY_STABLE_CLAUSE_END",
                "claims": [
                    {
                        "claim_id": "c1",
                        "text": f"echo {body['text']}",
                        "citation_id": "DOC_1 §1.1",
                        "quote": "q",
                        "status": "verified",
                        "reason_code": "QUOTE_MATCH_AND_ENTAILED",
                        "version": 1,
                        "sub_intent": None,
                    },
                    {
                        "claim_id": "c2",
                        "text": "unsupported",
                        "citation_id": None,
                        "quote": None,
                        "status": "uncertainty",
                        "reason_code": "ID_NOT_IN_RETRIEVAL_SET",
                        "version": 1,
                        "sub_intent": "refund window",
                    },
                ],
                "diff": {"added": ["c1"], "superseded": [], "unchanged": []},
                "evidence": [],
            },
        )
    if path == "/api/claims/tok":
        return httpx.Response(200, json={"claims": [{"claim_id": "c1"}]})
    if path == "/api/telemetry/verify":
        return httpx.Response(200, json={"valid": True, "event_count": 3})
    return httpx.Response(404)


def make_client() -> PreludeClient:
    return PreludeClient("http://gateway.test/api", transport=httpx.MockTransport(fake_gateway))


def test_start_session_returns_token():
    assert make_client().start_session() == {"session_id": "s1", "token": "tok"}


def test_turn_posts_chunk_and_returns_claims():
    turn = make_client().turn("tok", 0, "hello")
    assert turn["decision"] == "retrieve"
    assert turn["claims"][0]["text"] == "echo hello"


def test_claims_and_verify_round_trip():
    client = make_client()
    assert client.claims("tok") == [{"claim_id": "c1"}]
    assert client.verify_telemetry()["valid"] is True


def test_render_answer_keeps_citations_and_separates_unsupported():
    text = render_answer(make_client().turn("tok", 0, "hello"))
    assert "- echo hello [DOC_1 §1.1]" in text
    assert "not supported by the corpus:" in text
    assert "refund window (ID_NOT_IN_RETRIEVAL_SET)" in text


def test_render_answer_with_no_claims():
    rendered = render_answer({"decision": "wait", "reason_code": "NO_CLAUSE_BOUNDARY", "claims": []})
    assert "(no claims yet)" in rendered
