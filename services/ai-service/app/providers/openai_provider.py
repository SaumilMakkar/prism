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
    def __init__(self) -> None:
        from openai import OpenAI

        self._client = OpenAI()

    def complete(self, system: str, user: str, model: str) -> str:
        response = self._client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content or ""
