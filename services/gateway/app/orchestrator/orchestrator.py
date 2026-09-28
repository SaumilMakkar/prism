"""Orchestrator — ties controller -> decompose -> hybrid search -> synthesize
-> verify -> claim graph together for a single turn. ADR-0001: this is the
service that sees the whole request, so it owns the sequencing; each step
is a plain HTTP call to the service that owns that capability.
"""
from __future__ import annotations

import time
import uuid

import httpx
from prism_core.controller import ChunkFeatures
from prism_core.schemas import Claim, ClaimDiff, Decision, RetrievalHit

from app.claims.store import ClaimGraphStore
from app.controller.controller import SessionControllers
from app.telemetry.telemetry import TelemetryWriter
from app.verifier.verifier import verify_claims


class Orchestrator:
    def __init__(
        self,
        controllers: SessionControllers,
        claim_store: ClaimGraphStore,
        telemetry: TelemetryWriter,
        vector_service_url: str,
        ai_service_url: str,
        ml_service_url: str,
    ) -> None:
        self.controllers = controllers
        self.claim_store = claim_store
        self.telemetry = telemetry
        self.vector_service_url = vector_service_url
        self.ai_service_url = ai_service_url
        self.ml_service_url = ml_service_url

    def _nli(self, premise: str, hypothesis: str) -> bool:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{self.ml_service_url}/nli", json={"premise": premise, "hypothesis": hypothesis}
            )
            resp.raise_for_status()
            return resp.json()["entailed"]

    def _search(self, query: str, top_k: int = 5) -> list[RetrievalHit]:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"{self.vector_service_url}/search", params={"query": query, "top_k": top_k}
            )
            resp.raise_for_status()
            return [RetrievalHit.model_validate(h) for h in resp.json()["hits"]]

    def _decompose(self, session_id: str, text: str) -> tuple[list[str], str]:
        entities = self.controllers.entities_for(session_id)
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{self.ai_service_url}/decompose",
                json={"session_id": session_id, "text": text, "session_entities": entities},
            )
            resp.raise_for_status()
            data = resp.json()
            return data["sub_queries"], data["source"]

    def _synthesize(self, session_id: str, sub_query: str, evidence: list[RetrievalHit]) -> tuple[list[Claim], str]:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{self.ai_service_url}/synthesize",
                json={
                    "session_id": session_id,
                    "sub_query": sub_query,
                    "evidence": [h.model_dump(mode="json") for h in evidence],
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return [Claim.model_validate(c) for c in data["claims"]], data["source"]

    def process_chunk(self, session_id: str, session_id_hash: str, chunk_index: int, text: str) -> dict:
        trace_id = str(uuid.uuid4())

        t0 = time.perf_counter()
        decision = self.controllers.decide(session_id, chunk_index, text, trace_id)
        self.telemetry.emit(
            "controller_decision",
            trace_id,
            session_id_hash,
            decision=decision.decision.value,
            reason_code=decision.reason_code,
            chunk_index=chunk_index,
            latency_ms=round((time.perf_counter() - t0) * 1000, 1),
        )

        if decision.decision == Decision.NO_RETRIEVAL:
            claims = self.claim_store.render(session_id_hash)
            self.telemetry.emit("claim_graph_updated", trace_id, session_id_hash, added=[], superseded=[], unchanged=[c.claim_id for c in claims])
            return self._response(trace_id, decision, claims, ClaimDiff(unchanged=[c.claim_id for c in claims]))

        if decision.decision == Decision.WAIT:
            claims = self.claim_store.render(session_id_hash)
            return self._response(trace_id, decision, claims, ClaimDiff())

        # RETRIEVE
        t0 = time.perf_counter()
        sub_queries, decompose_source = self._decompose(session_id, text)
        self.telemetry.emit(
            "decompose_completed",
            trace_id,
            session_id_hash,
            sub_queries=sub_queries,
            source=decompose_source,
            latency_ms=round((time.perf_counter() - t0) * 1000, 1),
        )

        all_claims: list[Claim] = []
        for sub_query in sub_queries:
            t0 = time.perf_counter()
            evidence = self._search(sub_query)
            self.telemetry.emit(
                "retrieval_completed",
                trace_id,
                session_id_hash,
                doc_ids=[h.citation_id for h in evidence],
                hybrid_flag=True,
                sub_query=sub_query,
                latency_ms=round((time.perf_counter() - t0) * 1000, 1),
            )

            t0 = time.perf_counter()
            proposed_claims, synth_source = self._synthesize(session_id, sub_query, evidence)
            self.telemetry.emit(
                "synthesis_completed",
                trace_id,
                session_id_hash,
                claim_ids=[c.claim_id for c in proposed_claims],
                source=synth_source,
                sub_query=sub_query,
                latency_ms=round((time.perf_counter() - t0) * 1000, 1),
            )

            t0 = time.perf_counter()
            verified_claims = verify_claims(proposed_claims, evidence, self._nli)
            verify_latency_ms = round((time.perf_counter() - t0) * 1000, 1)
            for claim in verified_claims:
                self.telemetry.emit(
                    "claim_verified",
                    trace_id,
                    session_id_hash,
                    claim_id=claim.claim_id,
                    status=claim.status.value,
                    reason_code=claim.reason_code,
                    citation_id=claim.citation_id,
                    latency_ms=verify_latency_ms,
                )
            all_claims.extend(verified_claims)

        diff = self.claim_store.upsert(session_id_hash, all_claims)
        self.telemetry.emit(
            "claim_graph_updated",
            trace_id,
            session_id_hash,
            added=diff.added,
            superseded=diff.superseded,
            unchanged=diff.unchanged,
        )

        rendered = self.claim_store.render(session_id_hash)
        return self._response(trace_id, decision, rendered, diff)

    @staticmethod
    def _response(trace_id: str, decision, claims: list[Claim], diff: ClaimDiff) -> dict:
        return {
            "trace_id": trace_id,
            "decision": decision.decision.value,
            "reason_code": decision.reason_code,
            "claims": [c.model_dump(mode="json") for c in claims],
            "diff": diff.model_dump(mode="json"),
        }
