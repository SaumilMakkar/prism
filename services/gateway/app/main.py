from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import httpx
import redis
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.claims.store import ClaimGraphStore, InMemoryStore
from app.controller.controller import SessionControllers
from app.orchestrator.orchestrator import Orchestrator
from app.security.security import hash_session_id, redact_pii, sign_session_token, verify_session_token
from app.telemetry.telemetry import TelemetryWriter

ML_SERVICE_URL = os.environ.get("ML_SERVICE_URL", "http://ml-service:8001")
VECTOR_SERVICE_URL = os.environ.get("VECTOR_SERVICE_URL", "http://vector-service:8002")
AI_SERVICE_URL = os.environ.get("AI_SERVICE_URL", "http://ai-service:8003")
REDIS_URL = os.environ.get("REDIS_URL", "")
# Read-only source for the guided tour (F14): committed streams, served by
# path so the web bundle never embeds eval content (hardcode-grep, SECURITY.md T8).
STREAMS_DIR = Path(os.environ.get("STREAMS_DIR", "/evaluation/streams"))

app = FastAPI(title="gateway")

try:
    _kv_store = redis.from_url(REDIS_URL) if REDIS_URL else InMemoryStore()
    _kv_store.get("healthcheck")  # noqa: no-op probe; falls through to except on failure
except Exception:
    _kv_store = InMemoryStore()

_claim_store = ClaimGraphStore(_kv_store)
_controllers = SessionControllers(ML_SERVICE_URL)
_telemetry = TelemetryWriter()
_orchestrator = Orchestrator(
    _controllers, _claim_store, _telemetry, VECTOR_SERVICE_URL, AI_SERVICE_URL, ML_SERVICE_URL
)


class SessionStartResponse(BaseModel):
    session_id: str
    token: str


class ChunkRequest(BaseModel):
    chunk_index: int
    text: str


def _require_session(token: str) -> str:
    session_id = verify_session_token(token)
    if session_id is None:
        raise HTTPException(status_code=401, detail="invalid or forged session token")
    return session_id


@app.get("/healthz")
def healthz() -> dict:
    # Best-effort: the header's mode badges (F12) read real values here
    # rather than the UI guessing/hardcoding them. A slow or down peer
    # must never fail the gateway's own health check.
    ai_mode = "unknown"
    ml_backend = "unknown"
    with httpx.Client(timeout=1.5) as client:
        try:
            ai_mode = client.get(f"{AI_SERVICE_URL}/healthz").json().get("mode", "unknown")
        except Exception:
            pass
        try:
            ml_backend = client.get(f"{ML_SERVICE_URL}/healthz").json().get("backend", "unknown")
        except Exception:
            pass
    return {"status": "ok", "ai_mode": ai_mode, "ml_backend": ml_backend}


@app.get("/cost/{token}")
def cost(token: str) -> dict:
    session_id = _require_session(token)
    with httpx.Client(timeout=5.0) as client:
        try:
            resp = client.get(f"{AI_SERVICE_URL}/cost/{session_id}")
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return {"session_id": session_id, "cumulative_usd": 0.0}


@app.get("/demo/streams")
def list_demo_streams() -> dict:
    if not STREAMS_DIR.exists():
        return {"streams": []}
    return {"streams": sorted(p.stem for p in STREAMS_DIR.rglob("*.json"))}


@app.get("/demo/streams/{name}")
def get_demo_stream(name: str) -> dict:
    matches = [p for p in STREAMS_DIR.rglob("*.json") if p.stem == name]
    if not matches:
        raise HTTPException(status_code=404, detail="unknown demo stream")
    return json.loads(matches[0].read_text(encoding="utf-8"))


@app.post("/session/start", response_model=SessionStartResponse)
def start_session() -> SessionStartResponse:
    session_id = str(uuid.uuid4())
    return SessionStartResponse(session_id=session_id, token=sign_session_token(session_id))


@app.post("/turn/{token}")
def process_turn(token: str, req: ChunkRequest) -> dict:
    session_id = _require_session(token)
    session_id_hash = hash_session_id(session_id)
    clean_text = redact_pii(req.text)
    return _orchestrator.process_chunk(session_id, session_id_hash, req.chunk_index, clean_text)


@app.get("/claims/{token}")
def get_claims(token: str) -> dict:
    session_id = _require_session(token)
    claims = _claim_store.render(hash_session_id(session_id))
    return {"claims": [c.model_dump(mode="json") for c in claims]}


@app.get("/telemetry/verify")
def telemetry_verify() -> dict:
    return {"valid": _telemetry.verify(), "event_count": len(_telemetry.read_all())}


@app.get("/telemetry/{token}")
def telemetry_for_session(token: str) -> dict:
    """This session's own events only — never another session's (privacy;
    see SECURITY.md). Powers the telemetry pane, sub-query fan-out, and
    latency waterfall (F13/F18); the UI derives all of those from these
    real recorded events rather than the gateway inventing a separate shape.
    """
    session_id = _require_session(token)
    session_id_hash = hash_session_id(session_id)
    events = [e for e in _telemetry.read_all() if e.get("session_id_hash") == session_id_hash]
    return {"events": events}
