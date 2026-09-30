# CLAUDE.md

AI context file for this repository, disclosed in [documentation/AI_Disclosure.pdf](documentation/AI_Disclosure.pdf) — the same posture as last year's winning team's `.github/copilot-instructions.md` (see [documentation/prelude.md](documentation/prelude.md) Section 8).

## What this project is

Prelude — a streaming, verifiable, refine-not-restart RAG engine for Samsung PRISM Gen AI Hackathon 3.0, Theme 4. Full positioning and rationale: `documentation/prelude.md`. Architecture and decisions: `documentation/Architecture_Brief.md` and `documentation/adr/0001`–`0008`.

## Ground rules for any AI assistant working in this repo

1. **No LLM in the controller loop.** `packages/core/prism_core/controller.py` and `services/gateway/app/controller/` must never call an LLM or gain a `client`/`model` attribute — this is the guide's pitfall #1 (ADR-0003) and is guarded by a unit test.
2. **Never hardcode eval content.** No query text, answer, or adversarial Doc_ID from `evaluation/streams/` may appear anywhere under `services/` — tests included; use synthetic fixtures of the same shape. `scripts/check_no_eval_hardcode.py` (CI's hardcode-grep job, `make lint`) derives the forbidden literals from the streams. Corpus document ids (`KB_012`, `POL_004`, …) are public fixture data and are allowed.
3. **The verifier only subtracts.** `services/gateway/app/verifier/verifier.py` may reject a claim (move it to `uncertainty`) but must never edit, invent, or promote one. See ADR-0005.
4. **Keep `prism_core` dependency-free.** `packages/core` must not import from any `services/*` package — services depend on it, never the reverse.
5. **Small, real commits.** No single commit should implement an entire feature end-to-end across services — match the winning team's pattern of small, human-legible commits (`documentation/prelude.md` Section 8).
6. **Every new module gets a test.** `make test` should grow with the codebase, not just at the end.

## Where things live

- `packages/core/` — pure logic (schemas, controller, fusion, claim graph, hashchain), no I/O, no service dependency.
- `services/gateway/` — the only stateful, per-session service; owns the controller, orchestrator, session semantic cache (F9), claim store, verifier, telemetry, security.
- `services/ml-service/` — embedding, feature extraction, rerank, NLI. `ML_BACKEND=hash` (default) uses dependency-free fallbacks; `ML_BACKEND=transformer` uses the real bge-small/MiniLM models named in ADR-0002.
- `services/vector-service/` — ingestion, chunking, hybrid (BM25+dense) search.
- `services/ai-service/` — the only service that talks to OpenAI; `AI_MODE=live|record|offline|replay` (ADR-0007).
- `services/mcp-adapter/` — F19, a stateless MCP tool surface over the gateway HTTP API; never imported by any other service.
- `evaluation/harness/` — scoring logic (`scoring.py`, pure) separate from the HTTP client (`client.py`) so scoring is unit-testable without a running gateway.

## Disclosure

Team designs architecture, thresholds, evaluation methodology, and ADRs by hand. AI assistance (Claude Code) is used for implementation, boilerplate, and test scaffolding under team review — see `documentation/AI_Disclosure.pdf` for the feature-by-feature breakdown.
