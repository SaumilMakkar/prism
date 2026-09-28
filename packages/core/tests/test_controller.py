from prism_core.controller import ChunkFeatures, ControllerConfig, RulePolicy
from prism_core.schemas import Decision


def make_policy() -> RulePolicy:
    return RulePolicy(ControllerConfig(min_content_tokens=4, drift_cancel_threshold=0.35))


def test_waits_below_min_content_tokens():
    policy = make_policy()
    features = ChunkFeatures(chunk_index=0, content_tokens=2, entities=("Galaxy",), clause_boundary=True)
    result = policy.decide(features, trace_id="t1")
    assert result.decision == Decision.WAIT
    assert result.reason_code == "CONTENT_TOKENS_BELOW_MIN"


def test_waits_without_clause_boundary():
    policy = make_policy()
    features = ChunkFeatures(chunk_index=1, content_tokens=6, entities=("Galaxy",), clause_boundary=False)
    result = policy.decide(features, trace_id="t2")
    assert result.decision == Decision.WAIT
    assert result.reason_code == "NO_CLAUSE_BOUNDARY"


def test_retrieves_on_stable_entity_and_clause_end():
    policy = make_policy()
    features = ChunkFeatures(
        chunk_index=2, content_tokens=6, entities=("Galaxy phone",), clause_boundary=True
    )
    result = policy.decide(features, trace_id="t3")
    assert result.decision == Decision.RETRIEVE
    assert result.reason_code == "ENTITY_STABLE_CLAUSE_END"


def test_presentation_turn_never_retrieves():
    policy = make_policy()
    features = ChunkFeatures(
        chunk_index=3,
        content_tokens=10,
        entities=("Galaxy phone",),
        clause_boundary=True,
        is_presentation_turn=True,
    )
    result = policy.decide(features, trace_id="t4")
    assert result.decision == Decision.NO_RETRIEVAL
    assert result.reason_code == "PRESENTATION_TURN"


def test_drift_above_threshold_reanchors_mid_utterance():
    policy = make_policy()
    first = ChunkFeatures(
        chunk_index=0, content_tokens=6, entities=("Pune",), clause_boundary=True
    )
    policy.decide(first, trace_id="t5a")

    second = ChunkFeatures(
        chunk_index=1,
        content_tokens=6,
        entities=("Mumbai",),
        clause_boundary=True,
        embedding_drift=0.5,
    )
    result = policy.decide(second, trace_id="t5b")
    assert result.decision == Decision.RETRIEVE
    assert result.reason_code == "DRIFT_ABOVE_THRESHOLD_REANCHOR"


def test_no_llm_call_surface_exists_on_policy():
    # Guardrail against regressions that add an LLM call to the hot path
    # (ADR-0003 / prelude.md pitfall #1): the policy object must not expose
    # any attribute that looks like a model/client handle.
    policy = make_policy()
    forbidden = {"client", "model", "llm", "openai"}
    assert not (forbidden & set(vars(policy).keys()))
