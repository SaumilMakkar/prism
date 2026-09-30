"""A provider failure (bad key, unknown model) is a 502 with the reason."""
from fastapi.testclient import TestClient

from app import main


class ExplodingProvider:
    def complete(self, system, user, model):
        raise RuntimeError("Error code: 401 - Your API key has been invalidated.")


def test_decompose_maps_provider_failure_to_502(monkeypatch):
    monkeypatch.setattr(main._replaying, "provider", ExplodingProvider())
    monkeypatch.setattr(main._replaying, "mode", "live")
    resp = TestClient(main.app).post(
        "/decompose", json={"session_id": "s", "text": "hello", "session_entities": []}
    )
    assert resp.status_code == 502
    assert "LLM provider error" in resp.json()["detail"]
    assert "invalidated" in resp.json()["detail"]
