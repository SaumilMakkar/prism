from unittest.mock import patch

from prism_core.controller import ChunkFeatures

from app.controller.controller import SessionControllers


def _fake_features(entities):
    def _fetch(self, session_id, chunk_index, text):
        return ChunkFeatures(
            chunk_index=chunk_index,
            content_tokens=6,
            entities=entities,
            clause_boundary=True,
        )

    return _fetch


def test_entities_are_empty_before_any_decision():
    controllers = SessionControllers(ml_service_url="unused")
    assert controllers.entities_for("session-1") == []


def test_entities_for_reflects_most_recent_chunk_with_entities():
    controllers = SessionControllers(ml_service_url="unused")
    with patch.object(SessionControllers, "fetch_features", _fake_features(("Galaxy phone",))):
        controllers.decide("session-1", 0, "text", trace_id="t1")
    assert controllers.entities_for("session-1") == ["Galaxy phone"]


def test_entities_persist_across_a_chunk_with_no_entities():
    # A WAIT chunk with no detected entities should not erase what was
    # already anchored — F2 carries session entities forward, it does not
    # reset them on every chunk (prelude.md Section 9, F2).
    controllers = SessionControllers(ml_service_url="unused")
    with patch.object(SessionControllers, "fetch_features", _fake_features(("Galaxy phone",))):
        controllers.decide("session-1", 0, "text", trace_id="t1")
    with patch.object(SessionControllers, "fetch_features", _fake_features(())):
        controllers.decide("session-1", 1, "text", trace_id="t2")
    assert controllers.entities_for("session-1") == ["Galaxy phone"]


def test_sessions_are_isolated():
    controllers = SessionControllers(ml_service_url="unused")
    with patch.object(SessionControllers, "fetch_features", _fake_features(("Mumbai",))):
        controllers.decide("session-A", 0, "text", trace_id="t1")
    assert controllers.entities_for("session-B") == []


def test_features_for_is_none_before_any_decision():
    controllers = SessionControllers(ml_service_url="unused")
    assert controllers.features_for("session-1") is None


def test_features_for_reports_what_the_policy_evaluated():
    controllers = SessionControllers(ml_service_url="unused")
    with patch.object(SessionControllers, "fetch_features", _fake_features(("Galaxy phone",))):
        controllers.decide("session-1", 0, "text", trace_id="t1")
    features = controllers.features_for("session-1")
    assert features == {
        "content_tokens": 6,
        "entities": ["Galaxy phone"],
        "clause_boundary": True,
        "embedding_drift": 0.0,
        "is_presentation_turn": False,
    }
