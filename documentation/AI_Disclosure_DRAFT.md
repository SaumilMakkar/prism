# AI Disclosure (Draft)

<!-- Fill in Samsung's form once the docx is unlocked; this draft holds the answers until then. -->

Structure copied from last year's submitted form (`prelude.md` Section 11); content here is the working draft — finalize against the real `LangAI3.0_AI_Disclosure.docx` once unlocked by prism@samsung.com, and keep every line honest and specific to what actually happened, not what was planned.

Every "as built" and "modifications" line below is written from the repository's own history (`git log`, the tests that exist, the scorecard). Lines marked *(team to confirm)* state something the repo cannot show on its own — who made a given decision — and must be checked by both team members before submission, not deleted.

## Part 1 — Team details

| Field | Value |
|---|---|
| Team name | *(fill at submission)* |
| Project name | Prelude — Streaming Live RAG |
| Institution | *(fill at submission)* |
| Submission date | *(fill at submission)* |

## Part 2 — AI usage declaration

**Yes.**

## Part 3 — Purpose of AI usage

| Line | Our answer |
|---|---|
| Idea generation / brainstorming | Partial — product positioning (Live Agent Assist), gate strategy and architecture decided by the team; Claude used as a sounding board for the trade-off list and to survey current RAG techniques. |
| Code generation or assistance | Yes — Claude Code for implementation, refactoring, boilerplate and tests under team review; every module walked through by both members. `CLAUDE.md` in the repo root is the standing instruction file it worked from. |
| UI / UX design | Partial — the dashboard brief (`prompts/frontend_prompt.md`: layout, the eight moments, visual direction) was written by the team; Claude Code produced `services/web/DESIGN.md` and the React components against it, and DESIGN.md records where and why the build deviates from the brief. |
| Content creation | Yes — documentation structure and first drafts; all numbers come from the committed evaluation harness (`evaluation/results/scorecard.md`); the demo corpus is synthetic, generated with Claude and hand-checked. |
| Data analysis | No — evaluation methodology, metrics (G1–G6, headroom, false-positive rate), stream labels and threshold tuning by the team; scripts implement what the team specified. |
| Testing / debugging | Partial — Claude Code proposed fixes and wrote test scaffolding; the bugs named per feature below were found by running the real stack end to end and fixed in small reviewed commits. |
| Other | Prompt templates co-written and versioned in `prompts/`; recorded trajectories in `trajectories/` are recordings of what the providers actually returned (offline provider or live API), never hand-written. |

## Part 4 — Feature origin classification

One entry per feature from `prelude.md` Section 9 (F1–F19). All marked **Both**.

### F1 — Retrieval Controller (Trigger)
- **Team contribution:** feature set (entity anchors, embedding drift, clause boundaries, content-token minimum), rule policy design, thresholds, the stabilisation-headroom metric. *(team to confirm threshold values were chosen from labelled streams, not from AI suggestions.)*
- **AI tools used:** Claude Code.
- **AI assistance:** `packages/core/prism_core/controller.py` (rule policy), `services/ml-service/app/features/features.py` (feature extraction), FastAPI wiring, unit tests.
- **As built / modifications:** the entity fallback originally required capitalised tokens and never fired on real lowercase transcripts, leaving the controller stuck on `NO_STABLE_ENTITY` — found by an end-to-end run, rewritten to use stopword-filtered content words (commit `871ee94`). spaCy was later made optional so the hash backend and CI run without it. The logistic-regression policy (v2) is not built; only the rule policy ships.

### F2 — Multi-Intent Decomposer
- **Team contribution:** decomposition contract (strict JSON, cap of 4, near-duplicate merge rule), session-entity carry-over design.
- **AI tools used:** Claude Code.
- **AI assistance:** prompt drafting (`prompts/decompose.md`), JSON parsing and cap enforcement (`services/ai-service/app/decompose/decompose.py`), the deterministic offline provider.
- **As built / modifications:** the offline provider's split on "and"/","/";" stranded bare fillers ("Oh") as their own sub-query; fixed so a filler fragment is dropped unless it is the only fragment (`test_decompose_drops_bare_filler_fragment`). Session entities are carried from the controller's most recent chunk with entities, not reset on every WAIT.

### F3 — Hybrid Retrieval Engine
- **Team contribution:** BM25/dense/RRF/rerank pipeline design, hybrid-vs-dense ablation methodology, dedupe rule.
- **AI tools used:** Claude Code.
- **AI assistance:** BM25 index, Qdrant dense index, RRF (`packages/core/prism_core/fusion.py`), rerank wiring, provenance fields on `RetrievalHit`.
- **As built / modifications:** the cross-encoder rerank stage existed in ml-service but was never called by vector-service until the fused order was audited against ADR-0002; `/search` now reranks the fused top-10 (`RERANK_ENABLED`). Under `ML_BACKEND=hash` the reranker is a lexical-overlap fallback, not MiniLM. The dense-only ablation runs via `make eval-ablation`.

### F4 — Corpus Importer & Contextual Ingestion
- **Team contribution:** section-aware chunking scheme, `[Doc_ID §Section]` id design, version/effective-date metadata scheme, demo corpus authored and hand-checked.
- **AI tools used:** Claude Code (implementation), Claude (demo corpus generation).
- **AI assistance:** frontmatter markdown chunker (`services/vector-service/app/chunking`), ingestion (`app/ingest`).
- **As built / modifications:** a superseded policy version (`POL_004` v1) shared section ids with v2, so both were indexed and the citation id collided — RRF double-counted it and the verifier's id lookup became ambiguous. Ingestion now excludes `status: superseded` chunks (`test_superseded_chunks_are_excluded_from_the_index`). Only markdown is ingested; the pdf/docx/html parsers and the Batch-API contextual prefix from the plan are not built.

### F5 — Claim-Based Synthesis
- **Team contribution:** claim schema design, prose-rendering rule from claims.
- **AI tools used:** Claude Code.
- **AI assistance:** synthesis prompt (`prompts/synthesize.md`), response parsing, the offline provider's overlap heuristic.
- **As built / modifications:** the offline provider originally treated any nonzero word overlap as evidence, so a repair-SLA chunk that merely mentioned a component "answered" an off-corpus cost question — a real false positive from the no_evidence stream. Overlap is now measured against the question's own content words with a minimum ratio (`test_synthesize_rejects_chunk_with_only_incidental_word_overlap`). Claims are returned per turn, not token-streamed: `/turn` is synchronous.

### F6 — Grounding Verifier (Reflector)
- **Team contribution:** subtractive-only design (allow-list → quote match → NLI), uncertainty fallback rule.
- **AI tools used:** Claude Code.
- **AI assistance:** `services/gateway/app/verifier/verifier.py`, NLI checker in ml-service, tests for each rejection reason.
- **As built / modifications:** the verifier only subtracts (`CLAUDE.md` rule 3); every rejection carries a reason code (`ID_NOT_IN_RETRIEVAL_SET`, `QUOTE_MISMATCH`, `NOT_ENTAILED`) that the dashboard decodes into the three-step trail. Under `ML_BACKEND=hash` NLI is a lexical entailment heuristic, not a transformer. The clarification-request wording is rendered by the dashboard from the unresolved sub-intent, not generated by an LLM.

### F7 — Session Claim Graph & Delta Refinement
- **Team contribution:** claim-graph data model, affected-claim detection rule, diff-rendering contract (grey/green/struck-through).
- **AI tools used:** Claude Code.
- **AI assistance:** `packages/core/prism_core/claim_graph.py`, Redis-backed store, versioning.
- **As built / modifications:** the 30-minute TTL is proven by a fake-clock test rather than asserted (`test_session_expires_after_ttl_and_nothing_survives`). The dashboard mirrors expiry: at TTL it drops its own state and shows "Session expired; nothing was kept."

### F8 — Presentation-Turn Suppression
- **Team contribution:** presentation-turn detection rule, re-render-from-claims contract (zero retrieval).
- **AI tools used:** Claude Code.
- **AI assistance:** phrase-list detector in `features.py`, the `NO_RETRIEVAL` path in the orchestrator.
- **As built / modifications:** detection is a fixed phrase list, not the "tiny classifier" in the plan. A presentation turn re-renders stored claims with zero searches and zero LLM calls, and the dashboard's cost line says so.

### F9 — Speculative Cache & Sub-Query Dedupe
- **Team contribution:** cache scope decision (session-only), similarity threshold (cosine ≥ 0.9).
- **AI tools used:** Claude Code.
- **AI assistance:** `services/gateway/app/cache/semantic_cache.py` and the orchestrator integration.
- **As built / modifications:** built late (2026-09-29). Session-scoped by hash, never consulted across sessions (`test_cache_never_crosses_sessions`); a hit is recorded on the `retrieval_completed` event with its similarity and shown in the dashboard's fan-out as "cached". The "speculative" provisional-result reuse from the plan is not built; only the semantic dedupe is.

### F10 — Telemetry & Hash-Chained Observability
- **Team contribution:** event schema design, trace_id flow, hash-chain design, cost-meter accounting rules.
- **AI tools used:** Claude Code.
- **AI assistance:** `packages/core/prism_core/hashchain.py`, `services/gateway/app/telemetry`, `/telemetry/verify`, JSON Schema.
- **As built / modifications:** restarting the gateway against an existing JSONL file broke the chain, because a fresh writer linked its first event to genesis instead of the file's last hash — found by restarting the stack, fixed by resuming the chain tip (`test_writer_restart_resumes_the_chain_instead_of_breaking_it`). A `.gitignore` rule was also silently excluding the telemetry module from commits (commit `7461f18`). Events are JSONL only; the Redis stream from the plan is not built.

### F11 — Security Layer
- **Team contribution:** threat model (T1–T10), control-to-owner mapping.
- **AI tools used:** Claude Code.
- **AI assistance:** nginx config, HMAC session tokens, PII redaction, CI jobs.
- **As built / modifications:** `SECURITY.md`'s "Verified by" column originally named tests that did not exist; it now names the real ones. The CI hardcode check was two hand-picked grep patterns and missed three eval streams' text copied into test fixtures; it is now derived from the streams themselves (`scripts/check_no_eval_hardcode.py`). Trivy scan added to CI. No TLS in the local demo.

### F12 — Live Dashboard
- **Team contribution:** the build brief (`prompts/frontend_prompt.md`): layout, the eight moments, visual direction, engineering constraints.
- **AI tools used:** Claude Code.
- **AI assistance:** `services/web/` (React + Vite + TS, no component library), `DESIGN.md`, Vitest tests.
- **As built / modifications:** deviations from the brief are recorded in `DESIGN.md` (headroom shown in chunks not ms; mic posts finalized results only; tour drives real turns; hand-laid SVG graph). Several gateway additions were made rather than stubbing data in the web (`/healthz` modes and TTL, `/cost`, `/telemetry/{token}`, per-stage latencies, `features` and `cache_hit` on events, `evidence` on `/turn`). There is no SSE/WS stream; `/turn` is request/response.

### F13 — Evidence Graph View
- **Team contribution:** decision to include, scope (claims ↔ chunks ↔ documents, superseded edges greyed).
- **AI tools used:** Claude Code.
- **AI assistance:** `services/web/src/components/EvidenceGraph.tsx` and tests.
- **As built / modifications:** built as a hand-laid three-column SVG rather than react-force-graph-2d (no dependency, no motion); superseded edges greyed and dashed, dropped claims violet, a never-retrieved citation shown as "not retrieved".

### F14 — Guided Demo Tour
- **Team contribution:** the seven-moment script and caption content.
- **AI tools used:** Claude Code.
- **AI assistance:** `services/web/src/components/GuidedTour.tsx`, `GET /demo/streams` on the gateway.
- **As built / modifications:** captions never contain transcript text, answers, quotes or document ids; the tour fetches the committed streams from the gateway at runtime so nothing from `evaluation/` is bundled. The stream's `expected_safe_chunk_index` drives the ruler's safe marker.

### F15 — Evaluation Framework
- **Team contribution:** G1–G6 methodology, stream labelling scheme, ablation design, headroom metric definition.
- **AI tools used:** Claude Code.
- **AI assistance:** `evaluation/harness/` (scoring separate from the HTTP client so scoring is unit-tested), scorecard rendering, README sync check.
- **As built / modifications:** 7 labelled streams across 6 categories, not the 40–60 in the plan. Two streams had mislabelled `expected_safe_chunk_index` values, corrected after the first real run (commit `a3adf27`). The harness crashed on Windows consoles until stdout was forced to UTF-8 (commit `67acb35`). RAGAS is not integrated. The dense-only ablation is wired; the logistic-regression controller ablation is not built.

### F16 — Stream Simulator & Record/Replay
- **Team contribution:** live/record/offline/replay mode design, trajectory-commit policy.
- **AI tools used:** Claude Code.
- **AI assistance:** `services/ai-service/app/replay/replay.py`, offline provider, request-hash matching.
- **As built / modifications:** four modes, `offline` being the default (a deterministic provider, no key). `replay` fails loudly (HTTP 424) on a cache miss rather than falling back to live. Streams are chunk lists played sequentially by the harness and the tour; the timestamped player from the plan is not built.

### F17 — Microservices Packaging
- **Team contribution:** service boundaries (ADR-0001), healthcheck design, 90-second startup budget.
- **AI tools used:** Claude Code.
- **AI assistance:** Dockerfiles, `docker-compose.yml`, `images.yml` (GHCR), the compose-smoke CI job.
- **As built / modifications:** the compose-smoke job builds and drives one real turn through nginx on every push — the only job that would catch a broken bind mount or upstream name. The first `make up` on a clean machine is dominated by the ml-service image (sentence-transformers + spaCy) and exceeds the 90-second target; a cold build is minutes, a warm start is seconds. *(team to confirm measured cold-build time on the demo machine.)*

### F18 — Privacy & Consent Surface
- **Team contribution:** privacy stance (what is stored, TTL, no user ids), README Privacy & Data section content.
- **AI tools used:** Claude Code.
- **AI assistance:** `PrivacyNotice` component, `RAW_LOGGING=false` default in telemetry.
- **As built / modifications:** footer line plus first-visit dialog; the header shows the session id as the gateway hashes it, so a judge can match it to telemetry. Session expiry is surfaced in the UI (F7).

### F19 — MCP Adapter
- **Team contribution:** decision to expose as an adapter, not a core component (parsimony argument preserved).
- **AI tools used:** Claude Code (FastMCP wiring).
- **AI assistance:** `services/mcp-adapter/` — client, server, tests.
- **As built / modifications:** built late (2026-09-29) as a stateless wrapper over the gateway HTTP API; five tools; no other service imports it. Tests use an httpx mock transport.

## Part 5 — Ethical & compliance confirmation

- [ ] We confirm all AI-assisted content was reviewed, understood, and can be explained by both team members.
- [ ] We confirm no eval queries, answers, or document IDs from the judges' private benchmark are hardcoded anywhere in `services/` (`scripts/check_no_eval_hardcode.py` runs on every push).

## Part 6 — Declaration & sign-off

| Field | Value |
|---|---|
| Representative name | *(fill at submission)* |
| Role | *(fill at submission)* |
| Date | *(fill at submission)* |
