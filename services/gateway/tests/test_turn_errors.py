"""A peer failure must reach the client as a reason, not a bare 500."""
import httpx
from fastapi.testclient import TestClient

from app import main


def _status_error(status: int, body: dict) -> httpx.HTTPStatusError:
    request = httpx.Request("POST", "http://ai-service:8003/decompose")
    response = httpx.Response(status, json=body, request=request)
    return httpx.HTTPStatusError("boom", request=request, response=response)


def test_upstream_502_reason_is_passed_through(monkeypatch):
    def failing(*_args, **_kwargs):
        raise _status_error(502, {"detail": "LLM provider error: invalid API key"})

    monkeypatch.setattr(main._orchestrator, "process_chunk", failing)
    client = TestClient(main.app)
    token = client.post("/session/start").json()["token"]
    resp = client.post(f"/turn/{token}", json={"chunk_index": 0, "text": "hello there."})
    assert resp.status_code == 502
    assert "ai-service returned 502" in resp.json()["detail"]
    assert "invalid API key" in resp.json()["detail"]


def test_unreachable_peer_is_a_503(monkeypatch):
    def unreachable(*_args, **_kwargs):
        raise httpx.ConnectError("refused", request=httpx.Request("GET", "http://vector-service:8002/search"))

    monkeypatch.setattr(main._orchestrator, "process_chunk", unreachable)
    client = TestClient(main.app)
    token = client.post("/session/start").json()["token"]
    resp = client.post(f"/turn/{token}", json={"chunk_index": 0, "text": "hello there."})
    assert resp.status_code == 503
    assert "vector-service unreachable" in resp.json()["detail"]
