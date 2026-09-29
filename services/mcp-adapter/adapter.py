"""Prelude as an MCP tool surface — F19 (prelude.md Section 3.6, "optional
flourish"). This is an adapter over the gateway's public HTTP API, not a
core component: nothing here reaches into the engine, so removing it
changes nothing about how Prelude works (the parsimony argument in the
AI Disclosure draft).

`PreludeClient` is the pure HTTP wrapper; `server.py` exposes its methods
as MCP tools over stdio. Kept separate so this file is testable with an
httpx mock transport and no MCP runtime.
"""
from __future__ import annotations

import httpx

DEFAULT_GATEWAY_URL = "http://localhost/api"


class PreludeClient:
    def __init__(
        self, gateway_url: str = DEFAULT_GATEWAY_URL, transport: httpx.BaseTransport | None = None
    ) -> None:
        self.base_url = gateway_url.rstrip("/")
        self._client = httpx.Client(base_url=self.base_url, timeout=60.0, transport=transport)

    def start_session(self) -> dict:
        resp = self._client.post("/session/start")
        resp.raise_for_status()
        return resp.json()

    def turn(self, token: str, chunk_index: int, text: str) -> dict:
        resp = self._client.post(f"/turn/{token}", json={"chunk_index": chunk_index, "text": text})
        resp.raise_for_status()
        return resp.json()

    def claims(self, token: str) -> list[dict]:
        resp = self._client.get(f"/claims/{token}")
        resp.raise_for_status()
        return resp.json()["claims"]

    def verify_telemetry(self) -> dict:
        resp = self._client.get("/telemetry/verify")
        resp.raise_for_status()
        return resp.json()

    def health(self) -> dict:
        resp = self._client.get("/healthz")
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        self._client.close()


def render_answer(turn: dict) -> str:
    """Plain-text rendering of a /turn response for a voice-agent stack:
    verified claims with their `[Doc_ID §Section]` citations, then what the
    engine could not support. Never paraphrases a claim — the text is the
    claim text the verifier passed."""
    claims = turn.get("claims", [])
    verified = [c for c in claims if c.get("status") == "verified"]
    uncertain = [c for c in claims if c.get("status") != "verified"]

    lines: list[str] = [f"decision: {turn.get('decision')} ({turn.get('reason_code')})"]
    for c in verified:
        citation = f" [{c['citation_id']}]" if c.get("citation_id") else ""
        lines.append(f"- {c['text']}{citation}")
    if uncertain:
        lines.append("not supported by the corpus:")
        for c in uncertain:
            lines.append(f"- {c.get('sub_intent') or c['text']} ({c.get('reason_code')})")
    if not verified and not uncertain:
        lines.append("(no claims yet)")
    return "\n".join(lines)
