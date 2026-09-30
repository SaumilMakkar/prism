from scoring import (
    TurnResult,
    compute_false_positive_rate,
    compute_g2_headroom,
    compute_g3_multi_intent,
    compute_g4_citation_support,
    compute_g5_session_continuity,
    compute_g6_trace_coverage,
)


def test_g2_headroom_non_negative_when_controller_fires_after_safe_point():
    result = TurnResult(
        stream_id="s1",
        category="simple",
        decisions=[
            {"chunk_index": 0, "decision": "wait", "reason_code": "x"},
            {"chunk_index": 1, "decision": "retrieve", "reason_code": "x"},
        ],
        expected_safe_chunk_index=1,
    )
    pct, mean = compute_g2_headroom([result])
    assert pct == 100.0
    assert mean == 0


def test_g2_headroom_flags_premature_firing():
    result = TurnResult(
        stream_id="s1",
        category="noise",
        decisions=[{"chunk_index": 0, "decision": "retrieve", "reason_code": "x"}],
        expected_safe_chunk_index=2,
    )
    pct, mean = compute_g2_headroom([result])
    assert pct == 0.0
    assert mean == -2


def test_g3_multi_intent_counts_distinct_sub_intents():
    result = TurnResult(
        stream_id="s1",
        category="compound",
        final_claims=[
            {"status": "verified", "sub_intent": "warranty"},
            {"status": "verified", "sub_intent": "charging"},
        ],
        expected_min_subintents=2,
    )
    assert compute_g3_multi_intent([result]) == 100.0


def test_g4_citation_support_and_fabrication_detection():
    result = TurnResult(
        stream_id="s1",
        category="simple",
        final_claims=[
            {"status": "verified", "citation_id": "KB_012 §2.1"},
            {"status": "uncertainty", "citation_id": None},
        ],
    )
    support_pct, fabricated = compute_g4_citation_support([result])
    assert support_pct == 50.0
    assert fabricated == 0


def test_g4_excludes_explicit_no_evidence_claims_from_citation_support():
    # A NO_EVIDENCE_FOR_SUBQUERY claim is an honest "nothing to cite"
    # marker, not a citation that was proposed and failed — it must not
    # drag down the citation-support percentage the way a genuinely bad
    # citation would.
    result = TurnResult(
        stream_id="s1",
        category="simple",
        final_claims=[
            {"status": "verified", "citation_id": "KB_012 §2.1", "reason_code": "QUOTE_MATCH_AND_ENTAILED"},
            {"status": "uncertainty", "citation_id": None, "reason_code": "NO_EVIDENCE_FOR_SUBQUERY"},
        ],
    )
    support_pct, fabricated = compute_g4_citation_support([result])
    assert support_pct == 100.0
    assert fabricated == 0


def test_g5_session_continuity_requires_at_least_one_verified_claim():
    good = TurnResult(stream_id="s1", category="late_detail", final_claims=[{"status": "verified"}])
    bad = TurnResult(stream_id="s2", category="late_detail", final_claims=[{"status": "uncertainty"}])
    assert compute_g5_session_continuity([good, bad]) == 50.0


def test_g6_trace_coverage_caps_at_100():
    result = TurnResult(
        stream_id="s1", category="simple", decisions=[{"chunk_index": 0, "decision": "wait", "reason_code": "x"}]
    )
    assert compute_g6_trace_coverage([result], telemetry_event_count=999) == 100.0


def test_false_positive_rate_on_no_evidence_stream():
    result = TurnResult(
        stream_id="s1", category="no_evidence", final_claims=[{"status": "verified", "citation_id": "KB_012 §1"}]
    )
    assert compute_false_positive_rate([result]) == 100.0
