from __future__ import annotations

import os

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


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok"}


@app.post("/session/start", response_model=SessionStartResponse)
def start_session() -> SessionStartResponse:
    import uuid

    session_id = str(uuid.uuid4())
    return SessionStartResponse(session_id=session_id, token=sign_session_token(session_id))


@app.post("/turn/{token}")
def process_turn(token: str, req: ChunkRequest) -> dict:
    session_id = verify_session_token(token)
    if session_id is None:
        raise HTTPException(status_code=401, detail="invalid or forged session token")

    session_id_hash = hash_session_id(session_id)
    clean_text = redact_pii(req.text)
    return _orchestrator.process_chunk(session_id, session_id_hash, req.chunk_index, clean_text)


@app.get("/claims/{token}")
def get_claims(token: str) -> dict:
    session_id = verify_session_token(token)
    if session_id is None:
        raise HTTPException(status_code=401, detail="invalid or forged session token")
    claims = _claim_store.render(hash_session_id(session_id))
    return {"claims": [c.model_dump(mode="json") for c in claims]}


@app.get("/telemetry/verify")
def telemetry_verify() -> dict:
    return {"valid": _telemetry.verify(), "event_count": len(_telemetry.read_all())}
