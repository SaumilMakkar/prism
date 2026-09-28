# Security

<!-- Threat model T1–T10 + controls. A one-page condensed version goes into the Architecture Brief. -->

Full decision record: [ADR-0006](adr/0006-security-layer.md). This document is the expanded threat model; the brief carries only the summary table.

## Threat model

| ID | Threat | Attack surface | Control | Verified by |
|---|---|---|---|---|
| T1 | Oversized or malformed request floods the edge | Public HTTP/WS endpoint | nginx request size caps, rate limiting, TLS termination | Load test in `make bench`; manual fuzz during live-mic demo prep |
| T2 | Session hijacking via forged/guessed session id | Any endpoint keyed by session id | HMAC-signed session tokens verified at `gateway` before state lookup | `services/gateway/tests/test_security.py` |
| T3 | Prompt injection via retrieved corpus content (the injected `Doc_999` chunk) | Retrieval set passed to synthesis | Retrieved content never enters a system-role prompt; grounding verifier (ADR-0005) is the enforced backstop, not instruction-following | Live demo (Section 3.2 of prelude.md); `test_verifier_rejects_injected_chunk` |
| T4 | Fabricated citation IDs | Synthesis output | ID allow-list = this turn's retrieval set only | `test_verifier_zero_fabricated_ids` (property test over eval streams) |
| T5 | PII leakage into logs or telemetry | Transcript text, session metadata | Redaction pass before any log/telemetry write; `RAW_LOGGING=false` default | `test_telemetry_redaction` |
| T6 | Session data outliving its purpose | Redis | TTL 30 min, session-id-only key, no user identity field in schema | `test_session_expires_after_ttl` |
| T7 | Cross-session data leakage / profiling | Claim graph, cache | No cross-session index; session id is the sole key; no persistent user profile | `test_no_cross_session_read` |
| T8 | Hardcoded eval answers leaking into `services/` | Source tree | CI grep over `services/` for eval query/answer/Doc_ID strings from `evaluation/streams/` | `.github/workflows/ci.yml` hardcode-grep job |
| T9 | Vulnerable dependencies / container images | All services | Pinned lockfiles, Trivy scan in CI, minimal base images | `.github/workflows/ci.yml` trivy job |
| T10 | Unbounded LLM cost via runaway sub-queries or cache misses | `ai-service` | Decompose cap of 4 sub-queries, semantic cache dedupe (cosine ≥ 0.9), per-session cost ceiling | `services/ai-service/tests/test_cost_meter.py` |

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
