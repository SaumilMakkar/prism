# ADR-0008: Rejected alternatives

**Status:** Accepted

## Context

The guide scores architectural parsimony, and judge Q&A (Section 5 of `prelude.md`) specifically asks "why not X" for several popular alternatives. Recording what was considered and rejected, and why, is cheaper to do at decision time than to reconstruct under Q&A pressure — and it is exactly what a "considered-and-rejected" section is for in the brief.

## Decision

| Alternative | Why it looked attractive | Why rejected |
|---|---|---|
| **LangGraph / multi-agent orchestration** | Popular framework, handles branching flows out of the box, fashionable in 2026 submissions | Adds non-deterministic latency and hides decision points that judges specifically want to see with reasons (Section 2). In our design the model never owns a control-flow decision (ADR-0003) — a multi-agent framework's entire value proposition is agents making decisions, which is the opposite of what the guide rewards here. |
| **1M-token context window, no retrieval** | Simplest possible architecture; "just put the whole corpus in context" | Breaks per-claim citation (there is no retrieval set to allow-list against, ADR-0005), breaks corpus isolation between judges' private benchmarks, and per-turn cost scales with corpus size instead of query size. It also has no early-retrieval story at all — G2 becomes meaningless. |
| **Elasticsearch instead of Qdrant + BM25** | Mature, well-known hybrid search product | Heavier operational footprint (JVM, cluster config) for a single-node hackathon deployment with a ≤ 90 s `docker compose up` budget (Section 2); Qdrant's HNSW + a lightweight BM25 implementation covers the same hybrid-retrieval need (ADR-0002) at a fraction of the image size and startup time. |
| **Native mobile app (the on-device story, built rather than stated)** | Directly demonstrates the Galaxy-class on-device framing (Section 1) | Section 1 is explicit: state the on-device path with real model-size numbers (bge-small ≈ 33M, MiniLM ≈ 22M, spaCy-sm ≈ 12 MB) as future work, do not build it. Building it would consume the feature-freeze budget (Section 4) on a component that is not gated (G1–G6) and not scored directly. |
| **LLM-based controller (classifier-free, prompted)** | Simplest to implement — one prompt, no feature engineering | The guide's stated pitfall #1: ≈ 300 ms per call against an 0.8 s chunk cadence cannot keep up with speech (ADR-0003). Rejected as the *default*; kept only as a lighter-weight logistic-regression ablation with the same feature set, never an LLM call. |
| **Full per-feature microservices (8+ services)** | Maximal separation of concerns, "proper" microservices | No independent scaling or replacement justification beyond the five in ADR-0001; more services means more hops in the path judges watch, more images to pull inside the 90 s budget, and more surface area with no offsetting benefit. |
| **Fixed-window chunking instead of section-aware** | Simpler to implement, no document-structure parsing needed | Breaks citation ID stability across corpus versions and risks splitting a clause mid-sentence, which would break verbatim quote matching (ADR-0005) for claims that straddle a window boundary. |

## Consequences

- This table is reused near-verbatim in the Architecture Brief's "considered and rejected" section (Section 8 of `prelude.md`, referencing the winner's benchmark PDF outline) and is the primary source for judge Q&A rows on "why not X" (Section 5).
- Each rejection is tied to a concrete constraint from the guide or from a measured number elsewhere in the docs (hop cost, latency table, startup budget) rather than a stylistic preference — this is what makes the answers defensible under follow-up questions rather than restatements of the original claim.
- If any of these constraints change (e.g. the 90 s startup budget is relaxed, or corpus scale requirements grow past what Qdrant+BM25 comfortably handles), this ADR should be revisited rather than silently working around it in code.
