"""live / record / offline / replay modes — ADR-0007.

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

DEFAULT_TRAJECTORIES_DIR = "/trajectories"


def trajectories_dir_from_env() -> Path:
    return Path(os.environ.get("TRAJECTORIES_DIR", DEFAULT_TRAJECTORIES_DIR))


class ReplayMissError(RuntimeError):
    pass


def request_hash(system: str, user: str, model: str) -> str:
    payload = json.dumps({"system": system, "user": user, "model": model}, sort_keys=True)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]


class ReplayingProvider:
    """Wraps a live ChatProvider; mode is one of live / record / replay."""

    def __init__(
        self,
        provider: ChatProvider | None,
        mode: str = "replay",
        trajectories_dir: Path | None = None,
    ) -> None:
        self.provider = provider
        self.mode = mode
        # Resolved here, not at import, so TRAJECTORIES_DIR set by a test or
        # a compose file is honoured; created only when a mode writes to it
        # (replay never does, and CI runners cannot mkdir /trajectories).
        self.trajectories_dir = trajectories_dir or trajectories_dir_from_env()

    def _trajectory_path(self, key: str) -> Path:
        return self.trajectories_dir / f"{key}.json"

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

        if self.mode in ("record", "offline"):
            self.trajectories_dir.mkdir(parents=True, exist_ok=True)
            path.write_text(
                json.dumps(
                    {
                        "system": system,
                        "user": user,
                        "model": model,
                        "response": response,
                        "source": self.mode,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )

        return response, self.mode
