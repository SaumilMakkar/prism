"""Versioned, session-scoped claim graph — ADR-0004.

In-memory data structure; services/gateway persists a serialized ClaimGraph
to Redis with the session TTL. This module owns the diff semantics only.
"""
from __future__ import annotations

from prism_core.schemas import Claim, ClaimDiff, ClaimGraph


class SessionClaimGraph:
    def __init__(self, session_id_hash: str) -> None:
        self._graph = ClaimGraph(session_id_hash=session_id_hash)

    @property
    def graph(self) -> ClaimGraph:
        return self._graph

    def upsert(self, claims: list[Claim]) -> ClaimDiff:
        """Apply a batch of claims for one turn, returning the render diff.

        A claim with a claim_id already present is treated as a refinement
        (bumped version, marked superseded->added pair); a new claim_id is
        added; every other existing claim is unchanged. This is the only
        place "affected claim" is decided, so delta retrieval upstream and
        the dashboard diff downstream stay consistent with each other.
        """
        diff = ClaimDiff()
        existing_ids = set(self._graph.claims.keys())
        incoming_ids = {c.claim_id for c in claims}

        for claim in claims:
            if claim.claim_id in existing_ids:
                prev = self._graph.claims[claim.claim_id]
                claim.version = prev.version + 1
                diff.superseded.append(claim.claim_id)
                diff.added.append(claim.claim_id)
            else:
                claim.version = 1
                diff.added.append(claim.claim_id)
            self._graph.claims[claim.claim_id] = claim

        for claim_id in existing_ids - incoming_ids:
            diff.unchanged.append(claim_id)

        self._graph.version += 1
        return diff

    def render(self) -> list[Claim]:
        """Re-render all current claims with zero retrieval (F8)."""
        return list(self._graph.claims.values())
