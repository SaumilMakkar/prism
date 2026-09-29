"""Thin HTTP client for the running gateway — used by run_eval.py only.
Kept separate from scoring.py so scoring stays testable with no network.
"""
from __future__ import annotations

import httpx


class GatewayClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self._client = httpx.Client(timeout=30.0)

    def start_session(self) -> tuple[str, str]:
        resp = self._client.post(f"{self.base_url}/session/start")
        resp.raise_for_status()
        data = resp.json()
        return data["session_id"], data["token"]

    def send_chunk(self, token: str, chunk_index: int, text: str) -> dict:
        resp = self._client.post(
            f"{self.base_url}/turn/{token}",
            json={"chunk_index": chunk_index, "text": text},
        )
        resp.raise_for_status()
        return resp.json()

    def close(self) -> None:
        self._client.close()
