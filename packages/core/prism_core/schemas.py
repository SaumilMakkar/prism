"""Shapes shared across gateway / ml-service / vector-service / ai-service.

Single source of truth referenced by ADR-0001 (service boundaries) so every
service agrees on the wire format without importing each other's app code.
"""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Decision(str, Enum):
    WAIT = "wait"
    RETRIEVE = "retrieve"
    NO_RETRIEVAL = "no_retrieval"


class ClaimStatus(str, Enum):
    VERIFIED = "verified"
    UNCERTAINTY = "uncertainty"


class ControllerDecision(BaseModel):
    decision: Decision
    reason_code: str
    chunk_index: int
    trace_id: str


class RetrievalHit(BaseModel):
    doc_id: str
    section: str
    text: str
    score: float
    source: str = Field(description="'bm25' | 'dense' | 'fused'")

    @property
    def citation_id(self) -> str:
        return f"{self.doc_id} §{self.section}"


class Claim(BaseModel):
    claim_id: str
    text: str
    citation_id: Optional[str] = None
    quote: Optional[str] = None
    status: ClaimStatus = ClaimStatus.UNCERTAINTY
    reason_code: Optional[str] = None
    version: int = 1
    sub_intent: Optional[str] = None


class ClaimDiff(BaseModel):
    added: list[str] = Field(default_factory=list)
    superseded: list[str] = Field(default_factory=list)
    unchanged: list[str] = Field(default_factory=list)


class ClaimGraph(BaseModel):
    session_id_hash: str
    claims: dict[str, Claim] = Field(default_factory=dict)
    version: int = 0


class TelemetryEvent(BaseModel):
    event: str
    trace_id: str
    session_id_hash: Optional[str] = None
    ts: str
    payload: dict = Field(default_factory=dict)
