"""Claim-Based Synthesis — F5. Produces proposed claims (citation + verbatim
quote) from evidence chunks; verification (ADR-0005) happens downstream in
gateway, which is the only component allowed to mark a claim `verified`.
"""
from __future__ import annotations

import json
import uuid

from prism_core.schemas import Claim, ClaimStatus
from prism_core.schemas import RetrievalHit

from app.replay.replay import ReplayingProvider

SYSTEM_TEMPLATE = (
    "You answer using ONLY the evidence chunks provided. Return strict JSON: "
    '{{"claims": [{{"text": "...", "citation_id": "Doc_ID §Section", "quote": "verbatim substring"}}]}}. '
    "citation_id must be one of: {allowed_ids}. quote must be an exact substring of the cited chunk."
)


def _format_evidence(hits: list[RetrievalHit]) -> str:
    # The section heading often carries the exact phrasing a customer uses
    # ("Device powers on but restarts repeatedly") that the body text never
    # repeats verbatim — dropping it silently lost real information the
    # retrieval pipeline already measured (RetrievalHit.heading), for both
    # a real LLM and the offline fallback's own relevance check.
    # "Heading: " is a stable, unambiguous marker: OfflineProvider (which
    # only sees this flattened string, not the structured RetrievalHit)
    # uses it to fold the heading into relevance scoring while keeping quote
    # extraction scoped to the line(s) after it — a quote must stay a real
    # substring of h.text, never of the heading.
    blocks = []
    for h in hits:
        heading_line = f"Heading: {h.heading}\n" if h.heading else ""
        blocks.append(f"[{h.citation_id}]\n{heading_line}{h.text}")
    return "\n\n".join(blocks)


def parse_synthesize_response(raw: str, sub_intent: str) -> list[Claim]:
    try:
        data = json.loads(raw)
        raw_claims = data.get("claims", [])
    except (json.JSONDecodeError, AttributeError, TypeError):
        raw_claims = []

    claims: list[Claim] = []
    for item in raw_claims:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        claims.append(
            Claim(
                claim_id=str(uuid.uuid4()),
                text=text,
                citation_id=item.get("citation_id"),
                quote=item.get("quote"),
                status=ClaimStatus.UNCERTAINTY,  # verification happens in gateway
                sub_intent=sub_intent,
            )
        )
    return claims


def synthesize(
    sub_query: str,
    evidence: list[RetrievalHit],
    replaying_provider: ReplayingProvider,
    model: str,
) -> tuple[list[Claim], str]:
    allowed_ids = [h.citation_id for h in evidence]
    system = SYSTEM_TEMPLATE.format(allowed_ids=", ".join(allowed_ids) or "(no evidence)")
    user = f"Evidence:\n{_format_evidence(evidence)}\n\nQuestion: {sub_query}"
    raw, source = replaying_provider.complete(system, user, model)
    return parse_synthesize_response(raw, sub_intent=sub_query), source
