from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException
from prism_core.schemas import Claim, RetrievalHit
from pydantic import BaseModel

from app.cost.cost import CostCeilingExceeded, CostMeter
from app.decompose.decompose import decompose
from app.providers.offline_provider import OfflineProvider
from app.providers.openai_provider import DECOMPOSE_MODEL, SYNTHESIZE_MODEL, OpenAIProvider
from app.replay.replay import ReplayMissError, ReplayingProvider
from app.synthesize.synthesize import synthesize

# live: real OpenAI calls. record: real calls, saved to trajectories/.
# offline (default): deterministic, no-network, no-key provider — also
# saved to trajectories/, tagged source=offline, so `make up`/`make eval`
# work with zero setup (ADR-0007). replay: never touches the network,
# serves a committed trajectory by hash, fails loudly on a miss.
MODE = os.environ.get("AI_MODE", "offline")

app = FastAPI(title="ai-service")

if MODE in ("live", "record"):
    _provider = OpenAIProvider()
elif MODE == "offline":
    _provider = OfflineProvider()
else:
    _provider = None
_replaying = ReplayingProvider(_provider, mode=MODE)
_cost_meter = CostMeter()


class DecomposeRequest(BaseModel):
    session_id: str
    text: str
    session_entities: list[str] = []


class DecomposeResponse(BaseModel):
    sub_queries: list[str]
    source: str


class SynthesizeRequest(BaseModel):
    session_id: str
    sub_query: str
    evidence: list[RetrievalHit]


class SynthesizeResponse(BaseModel):
    claims: list[Claim]
    source: str


@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "mode": MODE}


@app.post("/decompose", response_model=DecomposeResponse)
def decompose_endpoint(req: DecomposeRequest) -> DecomposeResponse:
    try:
        sub_queries, source = decompose(
            req.text, req.session_entities, _replaying, DECOMPOSE_MODEL
        )
    except ReplayMissError as exc:
        raise HTTPException(status_code=424, detail=str(exc)) from exc
    _meter(req.session_id, req.text, sub_queries)
    return DecomposeResponse(sub_queries=sub_queries, source=source)


@app.post("/synthesize", response_model=SynthesizeResponse)
def synthesize_endpoint(req: SynthesizeRequest) -> SynthesizeResponse:
    try:
        claims, source = synthesize(req.sub_query, req.evidence, _replaying, SYNTHESIZE_MODEL)
    except ReplayMissError as exc:
        raise HTTPException(status_code=424, detail=str(exc)) from exc
    _meter(req.session_id, req.sub_query, claims)
    return SynthesizeResponse(claims=claims, source=source)


@app.get("/cost/{session_id}")
def cost(session_id: str) -> dict:
    return {"session_id": session_id, "cumulative_usd": _cost_meter.session_total(session_id)}


def _meter(session_id: str, input_text: str, output) -> None:
    if MODE in ("replay", "offline"):
        return  # neither mode touches the network — nothing to charge
    input_tokens = max(1, len(input_text.split()))
    output_tokens = max(1, len(str(output).split()))
    try:
        _cost_meter.charge(session_id, input_tokens, output_tokens)
    except CostCeilingExceeded as exc:
        raise HTTPException(status_code=429, detail=str(exc)) from exc
