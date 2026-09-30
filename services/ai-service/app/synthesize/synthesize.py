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

# Mirrors prompts/synthesize.md (the team-authored contract). The rules
# after the schema are what stop a live model from writing commentary
# ("the evidence does not explain…") as if it were a claim: such items are
# not claims, cannot carry a verbatim quote, and would only be dropped by
# the verifier downstream — the model is told to return nothing instead.
SYSTEM_TEMPLATE = (
    "You answer using ONLY the evidence chunks provided. Return strict JSON: "
    '{{"claims": [{{"text": "...", "citation_id": "Doc_ID §Section", "quote": "verbatim substring"}}]}}. '
    "Rules: citation_id must be one of: {allowed_ids} — never invent an id. "
    "quote must be an exact, verbatim substring of the cited chunk's text, not a paraphrase; "
    "if you cannot find a supporting verbatim quote, omit the claim. "
    "Each claim states a fact from the evidence that answers the question. "
    "If no evidence answers the question, return {{\"claims\": []}} — do not explain what the "
    "evidence lacks, do not apologise, do not describe the evidence."
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
        if not isinstance(item, dict):
            continue
        text = str(item.get("text", "")).strip()
        citation_id = item.get("citation_id")
        quote = item.get("quote")
        # A claim without a citation or a quote can never be verified
        # (ADR-0005) and the prompt says to omit it; it is model commentary,
        # not a claim, so it is dropped here rather than shown as a
        # "dropped by the verifier" row that a judge would have to decode.
        if not text or not citation_id or not quote:
            continue
        claims.append(
            Claim(
                claim_id=str(uuid.uuid4()),
                text=text,
                citation_id=str(citation_id),
                quote=str(quote),
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
