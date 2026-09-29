from app.features.features import (
    content_token_count,
    embedding_drift,
    extract_entities,
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
    assert is_presentation_turn("could you repeat that, but shorter") is True
    assert is_presentation_turn("my phone is broken") is False


def test_embedding_drift_zero_on_first_chunk():
    assert embedding_drift(None, [1.0, 0.0]) == 0.0


def test_embedding_drift_high_on_orthogonal_vectors():
    drift = embedding_drift([1.0, 0.0], [0.0, 1.0])
    assert drift > 0.9


def test_embedding_drift_low_on_identical_vectors():
    drift = embedding_drift([1.0, 0.0], [1.0, 0.0])
    assert drift < 0.01


def test_extract_entities_finds_content_anchor_in_lowercase_transcript():
    # Real transcripts are mostly lowercase common nouns, not proper nouns —
    # the fallback must not require capitalization to find an anchor.
    entities = extract_entities("my phone will not power on at all")
    assert "phone" in entities


def test_extract_entities_prefers_capitalized_proper_nouns_when_present():
    entities = extract_entities("My Galaxy phone will not power on")
    assert "Galaxy" in entities
    assert "phone" not in entities  # capitalized tokens take priority over content words


def test_extract_entities_excludes_stopwords():
    entities = extract_entities("what is the warranty period for this")
    assert "warranty" in entities
    assert "what" not in entities
    assert "this" not in entities


def test_presentation_phrase_inside_a_long_utterance_is_not_a_presentation_turn():
    # "make it shorter" buried in a 20-word story about something else must
    # not suppress retrieval for the whole chunk (seen live on the mic).
    text = "please record my message and can you make it shorter actually yesterday my phone stopped charging after the update"
    assert is_presentation_turn(text) is False
