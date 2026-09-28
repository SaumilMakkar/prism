# ADR-0007: LLM choice and replay

**Status:** Accepted

## Context

Two independent problems: (1) which model handles decomposition and synthesis, at what cost, and (2) how the team runs `make eval` and demos repeatedly during a 2-3 week build without burning credits or depending on live API availability at demo time — G1 (reproducibility) explicitly requires this.

## Decision

**Model choice:** GPT-5.6 Luna for the two latency-sensitive, quality-sensitive calls in the live path — multi-intent decomposition (F2) and claim synthesis (F5). GPT-5 nano, called once per document via the Batch API, for generating the contextual ingestion prefix (F4) — this call is off the live path entirely (one-time, at ingestion) so it is priced and latency-budgeted separately from everything in the Section 5 latency table.

**Record/replay:** `ai-service` runs in one of four modes, switched by env var:
- `live` — real API calls, used during development and for the actual judged demo.
- `record` — real API calls, with the request/response pair written to `trajectories/` (F16), used when building out the evaluation streams and the demo script.
- `offline` — **the default.** No network call and no API key; a deterministic, dependency-free heuristic provider (`services/ai-service/app/providers/offline_provider.py`) implements the same decompose/synthesize JSON contracts a real model would. Also writes to `trajectories/`, tagged `source: offline`, so it can never be confused with a genuine API recording. This is what makes the Section 6 claim ("`make eval` runs offline, on a plane, with no API key") true from a completely clean clone — `replay` alone could not deliver that until a `record` pass had already populated `trajectories/`, which was a circular requirement for a fresh checkout.
- `replay` — no network call; responses are served from committed `trajectories/` files matched by request hash, failing loudly (HTTP 424) on any miss rather than falling back. Used once `trajectories/` is populated (by `record` or `offline` runs) for fully deterministic re-runs, e.g. in CI.

Recorded trajectories are committed to the repo as real recordings of live calls, never hand-written — this is stated explicitly in the AI Disclosure draft (Section 11, "Other" line) because a hand-written trajectory pretending to be a model response would be exactly the kind of thing an AI-code check is designed to catch.

## Consequences

- Judges can run `make eval` offline, on a plane, with no API key — this is a concrete, checkable claim, not a slide bullet.
- `replay` mode must fail loudly (not silently fall back to `live`) on a cache miss, so a stale trajectory set is caught in CI rather than masking a real regression.
- Cost stays bounded and auditable: `ai-service/app/cost` meters every `live`/`record` call; Section 6's "$5–10 of existing credits for the whole hackathon" is a target this meter should be able to substantiate, not a guess.
- Because decomposition and synthesis are the only two live-path LLM calls, the entire controller (ADR-0003) and verifier (ADR-0005) remain deterministic and replayable even in `live` mode — replay determinism is not fighting the rest of the system's design, it is consistent with it.
- Batch-API ingestion prefixes (F4) are generated once and stored as corpus metadata, not regenerated per query — this keeps the nano cost fixed regardless of how many times the corpus is queried afterward.
