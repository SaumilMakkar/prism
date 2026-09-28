"""Grounding verifier — ADR-0005. Subtractive only: ID allow-list -> quote
match -> NLI entailment. A claim can only be rejected here, never edited or
promoted, which is what makes fabricated citations zero by construction
(SECURITY.md T3/T4) rather than a matter of model behaviour.
"""
from __future__ import annotations

from typing import Callable

from prism_core.schemas import Claim, ClaimStatus, RetrievalHit

NliFn = Callable[[str, str], bool]


def verify_claim(claim: Claim, retrieval_set: list[RetrievalHit], nli_fn: NliFn) -> Claim:
    allowed_ids = {hit.citation_id for hit in retrieval_set}

    if claim.citation_id not in allowed_ids:
        return claim.model_copy(
            update={"status": ClaimStatus.UNCERTAINTY, "reason_code": "ID_NOT_IN_RETRIEVAL_SET"}
        )

    chunk = next(h for h in retrieval_set if h.citation_id == claim.citation_id)

    if not claim.quote or claim.quote not in chunk.text:
        return claim.model_copy(
            update={"status": ClaimStatus.UNCERTAINTY, "reason_code": "QUOTE_MISMATCH"}
        )

    if not nli_fn(chunk.text, claim.text):
        return claim.model_copy(
            update={"status": ClaimStatus.UNCERTAINTY, "reason_code": "NOT_ENTAILED"}
        )

    return claim.model_copy(
        update={"status": ClaimStatus.VERIFIED, "reason_code": "QUOTE_MATCH_AND_ENTAILED"}
    )


def verify_claims(claims: list[Claim], retrieval_set: list[RetrievalHit], nli_fn: NliFn) -> list[Claim]:
    return [verify_claim(c, retrieval_set, nli_fn) for c in claims]
