"""Hash-chained telemetry — ADR-0006 / TELEMETRY.md.

Each event's hash includes the previous event's hash so an after-the-fact
edit to the JSONL trace is detectable by recomputing the chain.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field


@dataclass
class HashChain:
    genesis: str = "0" * 64
    _last_hash: str = field(init=False, default="")

    def __post_init__(self) -> None:
        self._last_hash = self.genesis

    def append(self, event: dict) -> dict:
        """Return the event augmented with prev_hash/hash; advances the chain."""
        prev_hash = self._last_hash
        payload = json.dumps(event, sort_keys=True, default=str).encode("utf-8")
        digest = hashlib.sha256(prev_hash.encode("utf-8") + payload).hexdigest()
        self._last_hash = digest
        return {**event, "prev_hash": prev_hash, "hash": digest}

    @staticmethod
    def verify(events: list[dict], genesis: str = "0" * 64) -> bool:
        """Recompute the chain over a list of already-hashed events."""
        expected_prev = genesis
        for event in events:
            stripped = {k: v for k, v in event.items() if k not in ("prev_hash", "hash")}
            if event.get("prev_hash") != expected_prev:
                return False
            payload = json.dumps(stripped, sort_keys=True, default=str).encode("utf-8")
            digest = hashlib.sha256(expected_prev.encode("utf-8") + payload).hexdigest()
            if digest != event.get("hash"):
                return False
            expected_prev = digest
        return True
