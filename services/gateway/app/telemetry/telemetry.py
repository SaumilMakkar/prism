"""Telemetry aggregator — F10. Writes hash-chained JSONL events; see
TELEMETRY.md for the event catalogue and trace_id flow this implements.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from prism_core.hashchain import HashChain

TELEMETRY_DIR = Path(os.environ.get("TELEMETRY_DIR", "/telemetry"))
RAW_LOGGING = os.environ.get("RAW_LOGGING", "false").lower() == "true"


class TelemetryWriter:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path or (TELEMETRY_DIR / "events.jsonl")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.chain = HashChain()
        self._event_seq = 0

        # Resume the chain's tip from whatever this file already ends
        # with — a fresh HashChain() appending to a non-empty file would
        # otherwise link its first new event to the wrong genesis and
        # break /telemetry/verify on the very next write (a real bug
        # caught by restarting gateway against a pre-existing file).
        existing = self.read_all()
        if existing:
            self.chain.resume(existing[-1]["hash"])
            self._event_seq = len(existing)

    def emit(self, event: str, trace_id: str, session_id_hash: str | None = None, **payload) -> dict:
        if not RAW_LOGGING:
            payload = {k: v for k, v in payload.items() if k not in ("raw_text", "transcript")}

        record = {
            "event": event,
            "trace_id": trace_id,
            "session_id_hash": session_id_hash,
            "ts": datetime.now(timezone.utc).isoformat(),
            "event_id": f"e{self._event_seq:06d}",
            **payload,
        }
        self._event_seq += 1
        linked = self.chain.append(record)
        with self.path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(linked, default=str) + "\n")
        return linked

    def read_all(self) -> list[dict]:
        if not self.path.exists():
            return []
        with self.path.open("r", encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    def verify(self) -> bool:
        return HashChain.verify(self.read_all(), genesis=self.chain.genesis)
