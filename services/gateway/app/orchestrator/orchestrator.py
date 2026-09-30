"""Orchestrator — ties controller -> decompose -> hybrid search -> synthesize
-> verify -> claim graph together for a single turn. ADR-0001: this is the
service that sees the whole request, so it owns the sequencing; each step
is a plain HTTP call to the service that owns that capability.
"""
from __future__ import annotations

import os
import time
import uuid

import httpx
from prism_core.controller import ChunkFeatures
from prism_core.schemas import Claim, ClaimDiff, ClaimStatus, Decision, RetrievalHit

from app.cache.semantic_cache import SessionSemanticCache
from app.claims.store import ClaimGraphStore
from app.controller.controller import SessionControllers
from app.telemetry.telemetry import TelemetryWriter
from app.verifier.verifier import verify_claims


# Ablation 1 (ADR-0002): HYBRID_ENABLED=false asks vector-service for
# dense-only ranking. `make eval-ablation` sets it on the gateway.
HYBRID_ENABLED = os.environ.get("HYBRID_ENABLED", "true").lower() == "true"


class Orchestrator:
    def __init__(
        self,
        controllers: SessionControllers,
        claim_store: ClaimGraphStore,
        telemetry: TelemetryWriter,
        vector_service_url: str,
        ai_service_url: str,
        ml_service_url: str,
        semantic_cache: SessionSemanticCache | None = None,
    ) -> None:
        self.controllers = controllers
        self.claim_store = claim_store
        self.telemetry = telemetry
        self.vector_service_url = vector_service_url
        self.ai_service_url = ai_service_url
        self.ml_service_url = ml_service_url
        # F9: session-scoped, cosine >= 0.9 — a sub-query this session has
        # already searched is served from memory instead of vector-service.
        self.semantic_cache = semantic_cache or SessionSemanticCache()

    def _nli(self, premise: str, hypothesis: str) -> bool:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                f"{self.ml_service_url}/nli", json={"premise": premise, "hypothesis": hypothesis}
            )
            resp.raise_for_status()
            return resp.json()["entailed"]

    def _embed(self, text: str) -> list[float] | None:
        """Query embedding for the semantic cache. Best-effort: if ml-service
        cannot embed, the cache is simply bypassed for this sub-query."""
        try:
            with httpx.Client(timeout=10.0) as client:
                resp = client.post(f"{self.ml_service_url}/embed", json={"texts": [text]})
                resp.raise_for_status()
                return resp.json()["vectors"][0]
        except Exception:
            return None

    def _retrieve(
        self, session_id_hash: str, sub_query: str
    ) -> tuple[list[RetrievalHit], bool, float | None]:
        """Hits for one sub-query: from the session cache when a near-
        duplicate was already searched (F9), otherwise a real search that is
        then cached. Returns (hits, cache_hit, similarity)."""
        vector = self._embed(sub_query)
        if vector is not None:
            found = self.semantic_cache.lookup(session_id_hash, vector)
            if found is not None:
                hits = [
                    h.model_copy(update={"sub_query": sub_query, "cache_hit": True})
                    for h in found.entry.hits
                ]
                return hits, True, found.similarity

        hits = [
            h.model_copy(update={"sub_query": sub_query, "cache_hit": False})
            for h in self._search(sub_query)
        ]
        if vector is not None:
            self.semantic_cache.store(session_id_hash, sub_query, vector, hits)
        return hits, False, None

    def _search(self, query: str, top_k: int = 5) -> list[RetrievalHit]:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"{self.vector_service_url}/search",
                params={"query": query, "top_k": top_k, "hybrid": HYBRID_ENABLED},
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
            features=self.controllers.features_for(session_id),
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
        all_evidence: list[RetrievalHit] = []
        for sub_query in sub_queries:
            t0 = time.perf_counter()
            evidence, cache_hit, similarity = self._retrieve(session_id_hash, sub_query)
            all_evidence.extend(evidence)
            self.telemetry.emit(
                "retrieval_completed",
                trace_id,
                session_id_hash,
                doc_ids=[h.citation_id for h in evidence],
                hybrid_flag=HYBRID_ENABLED,
                sub_query=sub_query,
                cache_hit=cache_hit,
                cache_similarity=round(similarity, 4) if similarity is not None else None,
                latency_ms=round((time.perf_counter() - t0) * 1000, 1),
            )

            t0 = time.perf_counter()
            proposed_claims, synth_source = self._synthesize(session_id, sub_query, evidence)

            no_evidence_claim = None
            if not proposed_claims:
                # Synthesis found nothing for THIS sub-question. Leaving the
                # claim graph untouched here would silently keep showing
                # whatever unrelated claim was already in the session from
                # an earlier topic — the dashboard has no way to tell a
                # judge "this is a stale answer to a different question"
                # apart from an explicit one. Recording an uncertainty claim
                # per sub-intent is what actually makes the "Not in the
                # corpus" block appear for a genuinely new, unanswerable
                # question, instead of nothing happening at all.
                no_evidence_claim = Claim(
                    claim_id=str(uuid.uuid4()),
                    text=f"No evidence found for: {sub_query}",
                    status=ClaimStatus.UNCERTAINTY,
                    reason_code="NO_EVIDENCE_FOR_SUBQUERY",
                    sub_intent=sub_query,
                )

            self.telemetry.emit(
                "synthesis_completed",
                trace_id,
                session_id_hash,
                claim_ids=[c.claim_id for c in proposed_claims]
                or ([no_evidence_claim.claim_id] if no_evidence_claim else []),
                source=synth_source,
                sub_query=sub_query,
                latency_ms=round((time.perf_counter() - t0) * 1000, 1),
            )

            if no_evidence_claim is not None:
                all_claims.append(no_evidence_claim)
                continue

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
        return self._response(trace_id, decision, rendered, diff, all_evidence)

    @staticmethod
    def _response(
        trace_id: str,
        decision,
        claims: list[Claim],
        diff: ClaimDiff,
        evidence: list[RetrievalHit] | None = None,
    ) -> dict:
        return {
            "trace_id": trace_id,
            "decision": decision.decision.value,
            "reason_code": decision.reason_code,
            "claims": [c.model_dump(mode="json") for c in claims],
            "diff": diff.model_dump(mode="json"),
            # This turn's retrieval set with full chunk text + provenance —
            # what the evidence drawer shows for a citation (F12/F13).
            "evidence": [
                {**h.model_dump(mode="json"), "citation_id": h.citation_id}
                for h in (evidence or [])
            ],
        }
