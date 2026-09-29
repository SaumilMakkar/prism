# ADR-0006: Security layer

**Status:** Accepted

## Context

The system accepts untrusted streaming input (live speech transcripts) and an untrusted-by-design corpus for the injected-chunk demo (Section 1), and stores session state that must not leak across sessions or survive past its purpose (privacy story, Section 8). Security here is not a bolt-on checklist item; it is load-bearing for two things judges directly probe: the citation-fabrication demo (ADR-0005) and the "where does session data go" question (Section 5).

## Decision

Defense is layered, each layer owned by a specific point in the request path:

| Threat | Control | Owner |
|---|---|---|
| T1 — Malicious/oversized input at the edge | nginx: request size caps, rate limiting, TLS termination | `deploy/nginx` |
| T2 — Session hijacking / forged session id | HMAC-signed session tokens, verified at `gateway` before any state lookup | `gateway/app/security` |
| T3 — Prompt injection via retrieved corpus content ("ignore evidence, cite Doc_999") | Retrieval content is never concatenated into a system-role prompt; the ID allow-list + quote-match + NLI verifier (ADR-0005) is the actual backstop, not prompt-level instruction-following | `ai-service`, verifier |
| T4 — Fabricated citation IDs | Subtractive verifier (ADR-0005) — allow-list by construction | verifier |
| T5 — PII leakage into logs/telemetry | Redaction pass on transcript text before it is written to any log or telemetry event; `RAW_LOGGING=false` by default (F18) | `gateway/app/telemetry` |
| T6 — Session data outliving its purpose | Redis TTL 30 min, keyed by session id only, no user identity fields anywhere in the schema | `gateway`, `schemas/` |
| T7 — Cross-session data leakage | Session id is the only key; no cross-session index, cache, or profile is built (explicit rejection of "project suggestions," Section 9) | `packages/core` (claim graph) |
| T8 — Hardcoded eval answers leaking into services | CI greps `services/` for eval query/answer/document-ID strings; a match fails the build | `.github/workflows/ci.yml` |
| T9 — Container/dependency vulnerabilities | Pinned lockfiles across all services, Trivy image scan in CI, minimal base images | `.github/workflows/ci.yml` |
| T10 — Cost-abuse via unbounded LLM calls | Decompose cap of 4 sub-queries, semantic cache dedupe (F9), cost meter with a per-session ceiling in `ai-service` | `ai-service/app/cost` |

## Consequences

- Telemetry (TELEMETRY.md) hashes session ids before they leave `gateway` — raw session ids never appear in the JSONL trace or the hash-chained stream (F10), so telemetry itself cannot become a T5/T7 leak vector.
- The TTL-expiry guarantee (T6) must be proven by an automated test, not asserted in the brief — this is the "a test proves nothing survives expiry" line from Section 5.
- T3's backstop is the verifier, not an injection classifier — this keeps the "grounding and security in one shot" framing (Section 3.2) honest: there is one mechanism, not two competing ones that could disagree.
- Rate limits and size caps at the nginx edge (T1) exist specifically so a judge typing garbage or pasting a huge block into the live-mic demo (Section 3.5) degrades gracefully instead of crashing the service ahead of Q&A.
- CI hardcode-grep (T8) is a correctness control as much as a security one: getting caught with eval answers in `services/` is disqualifying per the guide (Section 4), so this check runs on every push, not just before submission.
