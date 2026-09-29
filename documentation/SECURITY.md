# Security

<!-- Threat model T1–T10 + controls. A one-page condensed version goes into the Architecture Brief. -->

Full decision record: [ADR-0006](adr/0006-security-layer.md). This document is the expanded threat model; the brief carries only the summary table.

## Threat model

| ID | Threat | Attack surface | Control | Verified by |
|---|---|---|---|---|
| T1 | Oversized or malformed request floods the edge | Public HTTP endpoint | nginx `client_max_body_size 2m`, `limit_req` 20 r/s (burst 40) — `deploy/nginx/nginx.conf`; TLS termination is a deployment concern, not configured for the local demo | Config review; manual fuzz during live-mic demo prep (no automated load test yet) |
| T2 | Session hijacking via forged/guessed session id | Any endpoint keyed by session id | HMAC-signed session tokens verified at `gateway` before state lookup | `services/gateway/tests/test_security.py` |
| T3 | Prompt injection via retrieved corpus content (the injected adversarial chunk in `corpus/adversarial/`) | Retrieval set passed to synthesis | Retrieved content never enters a system-role prompt; grounding verifier (ADR-0005) is the enforced backstop, not instruction-following | Live demo (Section 3.2 of prelude.md); `test_injected_adversarial_chunk_cannot_reach_verified` in `services/gateway/tests/test_verifier.py`; the `adversarial_injection` eval stream |
| T4 | Fabricated citation IDs | Synthesis output | ID allow-list = this turn's retrieval set only | `test_claim_citing_id_outside_retrieval_set_is_rejected` (gateway); `test_g4_citation_support_and_fabrication_detection` in `evaluation/harness/tests/test_scoring.py`, scored over every eval stream by `make eval` |
| T5 | PII leakage into logs or telemetry | Transcript text, session metadata | Redaction pass before any log/telemetry write; `RAW_LOGGING=false` default | `test_redact_pii_removes_email_and_phone`, `test_raw_logging_false_strips_transcript_fields` in `services/gateway/tests/test_telemetry.py` |
| T6 | Session data outliving its purpose | Redis | TTL 30 min, session-id-only key, no user identity field in schema | `test_expire_now_clears_session` in `services/gateway/tests/test_claims_store.py` (expiry path; the 30-min TTL itself is Redis config, not yet covered by an automated clock-based test) |
| T7 | Cross-session data leakage / profiling | Claim graph | No cross-session index; session id is the sole key; no persistent user profile | `test_sessions_are_isolated` (claim store), `test_sessions_are_isolated_by_hash` (telemetry), `test_sessions_are_independent` (cost meter) |
| T8 | Hardcoded eval answers leaking into `services/` | Source tree | `scripts/check_no_eval_hardcode.py` forbids every query chunk and the adversarial Doc_ID from `evaluation/streams/` anywhere under `services/` (source and tests) | `.github/workflows/ci.yml` hardcode-grep job; `make lint` |
| T9 | Vulnerable dependencies / container images | All services | Pinned `requirements.txt` / `package-lock.json`, `python:3.11-slim` base images, Trivy filesystem scan (CRITICAL, fixable only) | `.github/workflows/ci.yml` trivy job |
| T10 | Unbounded LLM cost via runaway sub-queries | `ai-service` | Decompose cap of 4 sub-queries, per-session cost ceiling; the semantic cache (F9) is not built, so dedupe is not a control yet | `test_caps_at_four_even_if_model_returns_more` (decompose), `test_charge_raises_past_ceiling` in `services/ai-service/tests/test_cost.py` |

## Design principle

Grounding and security share one mechanism where possible (T3/T4 both resolve through the subtractive verifier in ADR-0005) rather than layering a separate injection classifier on top — one mechanism is easier to reason about, test, and explain in an AI-code-check Q&A than two that could disagree with each other.

## Privacy & Data (README excerpt)

- Session state: Redis, 30-minute TTL, keyed by session id only — no user identity is ever stored.
- Telemetry: session ids are hashed before leaving `gateway`; raw ids never appear in JSONL or the hash-chained stream.
- Corpus: judges mount their own corpus at `corpus/`; nothing from a judge's private benchmark is persisted beyond the session TTL.
- `RAW_LOGGING=false` by default — enabling it is an explicit opt-in for local debugging only, never set in the demo/eval profiles.

## What is explicitly out of scope for v1

- No authentication/authorization beyond session-token verification — this is a hackathon demo behind a single nginx edge, not a multi-tenant production deployment.
- No encryption at rest for Redis/Qdrant volumes — session TTL and the absence of user identity are the primary mitigations for the data that would need it.
