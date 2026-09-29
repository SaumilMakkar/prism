"""Pure scoring functions — G1-G6 plus the stabilisation-headroom metric and
false-positive analysis. No network I/O so these are unit-testable without a
running gateway; run_eval.py is the only module that calls a real service.
"""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class TurnResult:
    stream_id: str
    category: str
    decisions: list[dict] = field(default_factory=list)  # {chunk_index, decision, reason_code}
    final_claims: list[dict] = field(default_factory=list)  # {claim_id, status, citation_id, sub_intent}
    expected_safe_chunk_index: int | None = None
    expected_uncertain: bool = False
    expected_min_subintents: int = 1
    adversarial_doc_id: str | None = None


@dataclass
class Scorecard:
    g1_reproducibility: float
    g2_early_retrieval: float
    g3_multi_intent: float
    g4_citation_support: float
    g4_fabricated_ids: int
    g5_session_continuity: float
    g6_trace_coverage: float
    headroom_mean_chunks: float | None
    false_positive_rate: float

    def as_rows(self) -> list[tuple[str, float, bool]]:
        return [
            ("G1", self.g1_reproducibility, self.g1_reproducibility >= 90),
            ("G2", self.g2_early_retrieval, self.g2_early_retrieval >= 80),
            ("G3", self.g3_multi_intent, self.g3_multi_intent >= 70),
            ("G4", self.g4_citation_support, self.g4_citation_support >= 85 and self.g4_fabricated_ids == 0),
            ("G5", self.g5_session_continuity, self.g5_session_continuity >= 90),
            ("G6", self.g6_trace_coverage, self.g6_trace_coverage >= 100),
        ]


def first_retrieve_chunk_index(decisions: list[dict]) -> int | None:
    for d in decisions:
        if d["decision"] == "retrieve":
            return d["chunk_index"]
    return None


def compute_g2_headroom(results: list[TurnResult]) -> tuple[float, float | None]:
    """Returns (pct_streams_with_non_negative_headroom, mean_headroom_chunks).

    Headroom = fired_index - expected_safe_index. Non-negative means the
    controller never fired before the offline-computed safe point.
    """
    gaps: list[int] = []
    non_negative = 0
    scored = 0
    for r in results:
        if r.expected_safe_chunk_index is None:
            continue
        fired = first_retrieve_chunk_index(r.decisions)
        if fired is None:
            continue
        scored += 1
        gap = fired - r.expected_safe_chunk_index
        gaps.append(gap)
        if gap >= 0:
            non_negative += 1
    pct = (non_negative / scored * 100) if scored else 0.0
    mean = (sum(gaps) / len(gaps)) if gaps else None
    return pct, mean


def compute_g3_multi_intent(results: list[TurnResult]) -> float:
    compound = [r for r in results if r.category == "compound"]
    if not compound:
        return 0.0
    correct = 0
    for r in compound:
        sub_intents = {c.get("sub_intent") for c in r.final_claims if c.get("sub_intent")}
        if len(sub_intents) >= r.expected_min_subintents:
            correct += 1
    return correct / len(compound) * 100


def compute_g4_citation_support(results: list[TurnResult]) -> tuple[float, int]:
    all_claims = [c for r in results for c in r.final_claims]
    if not all_claims:
        return 0.0, 0
    verified = sum(1 for c in all_claims if c["status"] == "verified")
    fabricated = sum(
        1
        for c in all_claims
        if c["status"] == "verified" and c.get("citation_id") and _looks_fabricated(c)
    )
    return verified / len(all_claims) * 100, fabricated


def _looks_fabricated(claim: dict) -> bool:
    # A claim that reached "verified" status while citing the known
    # adversarial fixture id is fabricated by definition — see
    # corpus/adversarial/DOC_999_injected.md and ADR-0005.
    return "Doc_999" in (claim.get("citation_id") or "")


def compute_g5_session_continuity(results: list[TurnResult]) -> float:
    late_detail = [r for r in results if r.category == "late_detail"]
    if not late_detail:
        return 0.0
    correct = sum(1 for r in late_detail if any(c["status"] == "verified" for c in r.final_claims))
    return correct / len(late_detail) * 100


def compute_g6_trace_coverage(results: list[TurnResult], telemetry_event_count: int) -> float:
    expected_min_events = sum(len(r.decisions) for r in results)
    if expected_min_events == 0:
        return 100.0
    return min(100.0, telemetry_event_count / expected_min_events * 100)


def compute_false_positive_rate(results: list[TurnResult]) -> float:
    """Rate at which no_evidence streams incorrectly produce a verified claim."""
    no_evidence = [r for r in results if r.category == "no_evidence"]
    if not no_evidence:
        return 0.0
    false_positives = sum(1 for r in no_evidence if any(c["status"] == "verified" for c in r.final_claims))
    return false_positives / len(no_evidence) * 100


def build_scorecard(
    results: list[TurnResult],
    g1_reproducibility: float,
    telemetry_event_count: int,
) -> Scorecard:
    g2_pct, headroom_mean = compute_g2_headroom(results)
    g3 = compute_g3_multi_intent(results)
    g4_pct, fabricated = compute_g4_citation_support(results)
    g5 = compute_g5_session_continuity(results)
    g6 = compute_g6_trace_coverage(results, telemetry_event_count)
    fp_rate = compute_false_positive_rate(results)

    return Scorecard(
        g1_reproducibility=g1_reproducibility,
        g2_early_retrieval=g2_pct,
        g3_multi_intent=g3,
        g4_citation_support=g4_pct,
        g4_fabricated_ids=fabricated,
        g5_session_continuity=g5,
        g6_trace_coverage=g6,
        headroom_mean_chunks=headroom_mean,
        false_positive_rate=fp_rate,
    )
