"""HMAC session tokens + PII redaction — ADR-0006, threats T2 and T5.

Session ids are never logged raw: `hash_session_id` is applied before any
value reaches telemetry (TELEMETRY.md), satisfying T7 (no cross-session
leak surface) alongside T6 (TTL-bound Redis state).
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re

SESSION_SECRET = os.environ.get("SESSION_HMAC_SECRET", "dev-secret-change-me").encode("utf-8")

_EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
_PHONE_RE = re.compile(r"\b(?:\+?\d{1,3}[-.\s]?)?\d{10}\b")
_CARD_RE = re.compile(r"\b(?:\d[ -]?){13,16}\b")


def sign_session_token(session_id: str) -> str:
    signature = hmac.new(SESSION_SECRET, session_id.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{session_id}.{signature}"


def verify_session_token(token: str) -> str | None:
    try:
        session_id, signature = token.rsplit(".", 1)
    except ValueError:
        return None
    expected = hmac.new(SESSION_SECRET, session_id.encode("utf-8"), hashlib.sha256).hexdigest()
    if hmac.compare_digest(expected, signature):
        return session_id
    return None


def hash_session_id(session_id: str) -> str:
    return hashlib.sha256(session_id.encode("utf-8")).hexdigest()[:16]


def redact_pii(text: str) -> str:
    text = _EMAIL_RE.sub("[REDACTED_EMAIL]", text)
    text = _CARD_RE.sub("[REDACTED_CARD]", text)
    text = _PHONE_RE.sub("[REDACTED_PHONE]", text)
    return text
