# AI Disclosure (Draft)

<!-- Fill in Samsung's form once the docx is unlocked; this draft holds the answers until then. -->

Structure copied from last year's submitted form (`prelude.md` Section 11); content here is the working draft — finalize against the real `LangAI3.0_AI_Disclosure.docx` once unlocked by prism@samsung.com, and keep every line honest and specific to what actually happened, not what was planned.

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
| Code generation or assistance | Yes — Claude Code for implementation, refactoring, boilerplate and tests under team review; every module walked through by both members. |
| UI / UX design | Partial — dashboard layout and the demo tour designed by the team; Claude Code produced React/Tailwind components. |
| Content creation | Yes — documentation structure and first drafts; all numbers come from the committed evaluation harness; the demo corpus is synthetic, generated with Claude and hand-checked. |
| Data analysis | No — evaluation methodology, metrics (G1–G6, headroom, RAGAS), stream labels and threshold tuning by the team; scripts implement what the team specified. |
| Testing / debugging | Partial — Claude Code proposed fixes; the team resolved streaming, concurrency and container issues it could not. |
| Other | Prompt templates co-written and versioned in `prompts/`; recorded trajectories are recordings of live calls, not hand-written. |

## Part 4 — Feature origin classification

One entry per feature from `prelude.md` Section 9 (F1–F19). All marked **Both**; update the specifics as each feature is actually built — do not leave the wording generic at submission time, name the real bug the team fixed.

### F1 — Retrieval Controller (Trigger)
- **Team contribution:** feature set (entity anchors, embedding drift, clause boundaries, content-token minimum), rule policy design, all thresholds tuned on labelled streams, false-trigger analysis, the stabilisation-headroom metric.
- **AI tools used:** Claude Code.
- **AI assistance:** Python implementation of the feature extractor and policy module, FastAPI wiring, unit-test scaffolding.
- **Modifications:** team rewrote the drift-cancellation logic after the mid-sentence-correction edge case failed; team chose thresholds from the headroom curve, not from AI suggestions.

### F2 — Multi-Intent Decomposer
- **Team contribution:** decomposition contract (strict JSON, cap of 4, near-duplicate merge rule), session-entity carry-over design.
- **AI tools used:** Claude Code.
- **AI assistance:** prompt drafting, JSON schema validation code, retry/error-handling scaffolding.
- **Modifications:** *(fill in as built — name the specific failure case resolved.)*

### F3 — Hybrid Retrieval Engine
- **Team contribution:** BM25/dense/RRF/rerank pipeline design, hybrid-vs-dense ablation methodology, dedupe rule.
- **AI tools used:** Claude Code.
- **AI assistance:** Qdrant client integration, BM25 index implementation, cross-encoder reranker wiring.
- **Modifications:** *(fill in as built.)*

### F4 — Corpus Importer & Contextual Ingestion
- **Team contribution:** section-aware chunking scheme, `[Doc_ID §Section]` ID design, version/effective-date metadata scheme, demo corpus authored and hand-checked.
- **AI tools used:** Claude Code (implementation), Claude (demo corpus generation).
- **AI assistance:** multi-format parsers (md/txt/pdf/docx/html), Batch API integration for contextual prefixes.
- **Modifications:** *(fill in as built.)*

### F5 — Claim-Based Synthesis
- **Team contribution:** claim schema design, prose-rendering rule from claims.
- **AI tools used:** Claude Code.
- **AI assistance:** synthesis prompt implementation, streaming response handling.
- **Modifications:** *(fill in as built.)*

### F6 — Grounding Verifier (Reflector)
- **Team contribution:** subtractive-only design (allow-list → quote match → NLI), uncertainty fallback rule, clarification-request logic.
- **AI tools used:** Claude Code.
- **AI assistance:** NLI model integration, verifier pipeline implementation.
- **Modifications:** *(fill in as built — this is the feature to walk through in detail if a judge asks "how do you stop fabricated citations.")*

### F7 — Session Claim Graph & Delta Refinement
- **Team contribution:** claim-graph data model, affected-claim detection rule, diff-rendering contract (grey/green/struck-through).
- **AI tools used:** Claude Code.
- **AI assistance:** Redis persistence layer, versioning implementation.
- **Modifications:** *(fill in as built.)*

### F8 — Presentation-Turn Suppression
- **Team contribution:** presentation-turn detection rule, re-render-from-claims contract (zero retrieval).
- **AI tools used:** Claude Code.
- **AI assistance:** regex/classifier implementation.
- **Modifications:** *(fill in as built.)*

### F9 — Speculative Cache & Sub-Query Dedupe
- **Team contribution:** cache scope decision (session-only), similarity threshold (cosine ≥ 0.9).
- **AI tools used:** Claude Code.
- **AI assistance:** cache implementation.
- **Modifications:** *(fill in as built.)*

### F10 — Telemetry & Hash-Chained Observability
- **Team contribution:** event schema design, trace_id flow, hash-chain design, cost-meter accounting rules.
- **AI tools used:** Claude Code.
- **AI assistance:** schema implementation, JSONL/Redis stream wiring, `/telemetry/verify` endpoint.
- **Modifications:** *(fill in as built.)*

### F11 — Security Layer
- **Team contribution:** threat model (T1–T10), control-to-owner mapping.
- **AI tools used:** Claude Code.
- **AI assistance:** nginx config, HMAC token implementation, PII redaction pass, CI security jobs.
- **Modifications:** *(fill in as built.)*

### F12 — Live Dashboard
- **Team contribution:** panel layout and information hierarchy (transcript, lamp, sub-queries, versions, citations, cost meter, mic mode).
- **AI tools used:** Claude Code.
- **AI assistance:** React/Tailwind component implementation.
- **Modifications:** *(fill in as built.)*

### F13 — Evidence Graph View
- **Team contribution:** decision to include, scope (claims ↔ chunks ↔ documents, superseded edges greyed).
- **AI tools used:** Claude Code.
- **AI assistance:** react-force-graph-2d integration.
- **Modifications:** *(fill in as built, or mark "not built — cut at feature freeze" if it doesn't ship.)*

### F14 — Guided Demo Tour
- **Team contribution:** the three-example script, caption content.
- **AI tools used:** Claude Code.
- **AI assistance:** tour-playback implementation.
- **Modifications:** *(fill in as built.)*

### F15 — Evaluation Framework
- **Team contribution:** G1–G6 methodology, stream labelling scheme, ablation design, headroom metric definition.
- **AI tools used:** Claude Code.
- **AI assistance:** harness implementation, RAGAS integration.
- **Modifications:** *(fill in as built — this is the feature where "data analysis: No" from Part 3 should be visibly true.)*

### F16 — Stream Simulator & Record/Replay
- **Team contribution:** live/record/replay mode design, trajectory-commit policy.
- **AI tools used:** Claude Code.
- **AI assistance:** chunk-player implementation, request-hash matching for replay.
- **Modifications:** *(fill in as built.)*

### F17 — Microservices Packaging
- **Team contribution:** service boundaries (ADR-0001), healthcheck design, 90-second startup budget.
- **AI tools used:** Claude Code.
- **AI assistance:** Dockerfiles, compose file, CI image-publish workflow.
- **Modifications:** *(fill in as built.)*

### F18 — Privacy & Consent Surface
- **Team contribution:** privacy stance (what is stored, TTL, no user ids), README Privacy & Data section content.
- **AI tools used:** Claude Code.
- **AI assistance:** in-app notice component.
- **Modifications:** *(fill in as built.)*

### F19 — MCP Adapter
- **Team contribution:** decision to expose as an adapter, not a core component (parsimony argument preserved).
- **AI tools used:** Claude Code (FastMCP wiring).
- **AI assistance:** MCP server implementation.
- **Modifications:** *(fill in as built, or mark "not built — optional flourish, cut at feature freeze.")*

## Part 5 — Ethical & compliance confirmation

- [ ] We confirm all AI-assisted content was reviewed, understood, and can be explained by both team members.
- [ ] We confirm no eval queries, answers, or document IDs from the judges' private benchmark are hardcoded anywhere in `services/`.

## Part 6 — Declaration & sign-off

| Field | Value |
|---|---|
| Representative name | *(fill at submission)* |
| Role | *(fill at submission)* |
| Date | *(fill at submission)* |
