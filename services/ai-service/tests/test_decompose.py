from app.decompose.decompose import parse_decompose_response


def test_parses_valid_json():
    raw = '{"sub_queries": ["how do I fix charging?", "what is the warranty period?"]}'
    result = parse_decompose_response(raw, fallback_text="unused")
    assert result == ["how do I fix charging?", "what is the warranty period?"]


def test_caps_at_four_even_if_model_returns_more():
    raw = '{"sub_queries": ["q1", "q2", "q3", "q4", "q5", "q6"]}'
    result = parse_decompose_response(raw, fallback_text="unused")
    assert len(result) == 4


def test_falls_back_to_original_text_on_malformed_json():
    result = parse_decompose_response("not json at all", fallback_text="original transcript")
    assert result == ["original transcript"]


def test_merges_near_duplicate_sub_queries():
    raw = '{"sub_queries": ["how do I fix charging", "how do I fix the charging", "what is SmartThings"]}'
    result = parse_decompose_response(raw, fallback_text="unused")
    assert len(result) == 2
