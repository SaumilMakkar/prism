"""live / record / replay modes — ADR-0007.

`replay` never calls the network: it serves a committed trajectory by
request hash and fails loudly on a miss, so a stale trajectory set is caught
by CI rather than silently falling back to a live call.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from app.providers.openai_provider import ChatProvider

TRAJECTORIES_DIR = Path(os.environ.get("TRAJECTORIES_DIR", "/trajectories"))


class ReplayMissError(RuntimeError):
    pass


def request_hash(system: str, user: str, model: str) -> str:
    payload = json.dumps({"system": system, "user": user, "model": model}, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


class ReplayingProvider:
    """Wraps a live ChatProvider; mode is one of live / record / replay."""

    def __init__(self, provider: ChatProvider | None, mode: str = "replay") -> None:
        self.provider = provider
        self.mode = mode
        TRAJECTORIES_DIR.mkdir(parents=True, exist_ok=True)

    def _trajectory_path(self, key: str) -> Path:
        return TRAJECTORIES_DIR / f"{key}.json"

    def complete(self, system: str, user: str, model: str) -> tuple[str, str]:
        """Returns (response_text, source) where source is live/record/replay."""
        key = request_hash(system, user, model)
        path = self._trajectory_path(key)

        if self.mode == "replay":
            if not path.exists():
                raise ReplayMissError(
                    f"no recorded trajectory for hash {key} — run in record/live mode first"
                )
            data = json.loads(path.read_text(encoding="utf-8"))
            return data["response"], "replay"

        if self.provider is None:
            raise RuntimeError(f"mode={self.mode} requires a live provider")

        response = self.provider.complete(system, user, model)

        if self.mode == "record":
            path.write_text(
                json.dumps(
                    {"system": system, "user": user, "model": model, "response": response},
                    indent=2,
                ),
                encoding="utf-8",
            )
            return response, "record"

        return response, "live"
