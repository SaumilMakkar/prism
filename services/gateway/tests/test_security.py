from app.security.security import hash_session_id, redact_pii, sign_session_token, verify_session_token


def test_valid_token_round_trips():
    token = sign_session_token("session-123")
    assert verify_session_token(token) == "session-123"


def test_forged_token_is_rejected():
    token = sign_session_token("session-123")
    forged = token.rsplit(".", 1)[0] + ".deadbeef"
    assert verify_session_token(forged) is None


def test_malformed_token_is_rejected():
    assert verify_session_token("not-a-valid-token") is None


def test_hash_session_id_is_stable_and_not_reversible_length():
    h1 = hash_session_id("session-123")
    h2 = hash_session_id("session-123")
    assert h1 == h2
    assert h1 != "session-123"


def test_redact_pii_removes_email_and_phone():
    text = "contact me at user@example.com or 9876543210"
    redacted = redact_pii(text)
    assert "user@example.com" not in redacted
    assert "9876543210" not in redacted
