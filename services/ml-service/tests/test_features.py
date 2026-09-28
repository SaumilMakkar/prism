from app.features.features import (
    content_token_count,
    embedding_drift,
    has_clause_boundary,
    is_presentation_turn,
)


def test_clause_boundary_detects_terminal_punctuation():
    assert has_clause_boundary("the device won't turn on.") is True
    assert has_clause_boundary("the device won't turn") is False


def test_content_token_count_ignores_pure_whitespace():
    assert content_token_count("  ") == 0
    assert content_token_count("my phone is broken") == 4


def test_presentation_turn_detects_shorten_request():
    assert is_presentation_turn("can you say that again, shorter") is True
    assert is_presentation_turn("my phone is broken") is False


def test_embedding_drift_zero_on_first_chunk():
    assert embedding_drift(None, [1.0, 0.0]) == 0.0


def test_embedding_drift_high_on_orthogonal_vectors():
    drift = embedding_drift([1.0, 0.0], [0.0, 1.0])
    assert drift > 0.9


def test_embedding_drift_low_on_identical_vectors():
    drift = embedding_drift([1.0, 0.0], [1.0, 0.0])
    assert drift < 0.01
