"""OpenAI adapter — ADR-0007. GPT-5.6 Luna for decompose/synthesize (live
path); GPT-5 nano via Batch for one-time ingestion prefixes (not called from
here — that is a corpus-build-time script, off the live path entirely).
"""
from __future__ import annotations

import os
from typing import Protocol

DECOMPOSE_MODEL = os.environ.get("DECOMPOSE_MODEL", "gpt-5.6-luna")
SYNTHESIZE_MODEL = os.environ.get("SYNTHESIZE_MODEL", "gpt-5.6-luna")


class ChatProvider(Protocol):
    def complete(self, system: str, user: str, model: str) -> str: ...


class OpenAIProvider:
    """Client is built on first use, not at import: a missing key or an SDK
    problem then surfaces as a clear error on the first live call instead of
    crashing the service at boot (which takes the whole compose stack down
    through depends_on)."""

    def __init__(self) -> None:
        self._client = None

    def _get_client(self):
        if self._client is None:
            if not os.environ.get("OPENAI_API_KEY"):
                raise RuntimeError(
                    "AI_MODE=live/record needs OPENAI_API_KEY; use AI_MODE=offline (default) for a key-free run"
                )
            from openai import OpenAI

            self._client = OpenAI()
        return self._client

    def complete(self, system: str, user: str, model: str) -> str:
        response = self._get_client().chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content or ""
