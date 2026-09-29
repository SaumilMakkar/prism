# ADR-0004: Claim graph state

**Status:** Accepted

## Context

The theme requires refining an answer when new information arrives mid-conversation, not restarting the pipeline (G5, "refine-not-restart as a diff," Section 3.3). A plain conversation-history-plus-regenerate approach cannot show *which specific claims* changed, cannot preserve citations on unchanged claims, and cannot support "say that again, shorter" without a fresh LLM call. We need a representation of the answer that survives across turns within a session, can be diffed, and can be re-rendered without retrieval.

## Decision

The answer is stored as a **versioned claim graph**, keyed by session id: each claim is a node with text, citation(s) (`[Doc_ID §Section]` + verbatim quote), a support status (`verified` / `uncertain`), and a version number. When a new user turn arrives:

1. The controller (ADR-0003) decides whether retrieval is needed at all.
2. If it is, the decomposer (F2) and retrieval only target the **affected claims** — entities/topics touched by the new detail — not the whole answer (targeted delta retrieval, not a full re-run).
3. Affected claims are re-verified (ADR-0005) and bumped to a new version; unaffected claims keep their version and citations untouched.
4. The dashboard renders the diff directly from version numbers: unchanged = grey, added = green, superseded = struck through (F12, the "answer versions" panel; this diff *is* the Example 2 screenshot in Section 3.3).

State lives in Redis, keyed by session id only (no user identity), TTL 30 minutes (F7, F18; the privacy story in Section 8). A test asserts nothing survives expiry (judge Q&A, Section 5: "Where does session data go?").

## Consequences

- "Say that again, shorter" (F8) is a pure read of the current claim graph re-rendered at a different verbosity — zero retrieval, zero LLM call, which is the concrete proof point for the No-Retrieval branch of ADR-0003.
- Affected-claim detection (which claims does a new detail touch?) is itself a small, testable piece of logic in `packages/core`, unit-tested independently of any service being up.
- Session-bound TTL state means the claim graph is never a durable user profile — this is a deliberate boundary against the "project suggestions / notifications" feature the winner's app had and we explicitly rejected (Section 9, rejected list) because cross-session profiling is banned by the guide.
- The graph's version history is also what the Evidence Graph View (F13, could-have) visualises: claims ↔ chunks ↔ documents, with superseded edges greyed — it is a view over this same structure, not a separate data model.
- Because citations are attached per-claim and preserved across versions, a claim never has to be re-verified just because a *different* claim in the same answer changed — this bounds the cost of a refinement to the number of actually-affected claims, which is the number the headroom-style "delta retrieval" story in the brief should report.
