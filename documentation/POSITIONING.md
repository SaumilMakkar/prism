# Positioning

<!-- Live Agent Assist: strategy, differentiators, judge Q&A. -->

Source of truth for all claims here: `prelude.md` Sections 0–7. This document is the pitch-ready extraction — what to actually say, in order, without the reasoning trail.

## The one-line pitch

**Prelude** — a RAG engine that starts retrieving while the user is still speaking, splits a sentence into parallel sub-questions, refines an answer instead of restarting when new details arrive, and cites `[Doc_ID §Section]` on every claim or says it is uncertain.

## The product frame: Live Agent Assist

A customer is talking to a support agent. On the agent's screen, a grounded, cited answer forms *while the customer speaks*. When the customer adds a detail, the answer updates only the affected claims. When the customer asks for it shorter, nothing is retrieved — the stored answer is just re-rendered.

This is an established category (Google CCAI Agent Assist, Cresta, Observe.AI) with a real buyer (Samsung's own customer-care operation, where every second of average handling time is real cost) — not a novel idea. The win is positioning, proof, and honesty about limits, not invention.

## Four differentiators, in the order to lead with

1. **Measured earliness.** Not "we retrieve early" — a chart showing the offline-computed point where retrieval became safe (provisional/final top-k overlap ≥ 60%) versus when the controller actually fired, plus the gap distribution across the benchmark.
2. **Verifiable claims.** Every claim carries a citation and a verbatim quote; the verifier only subtracts (allow-list → quote match → NLI entailment). Live demo: an injected chunk is retrieved, the model tries to cite it, the verifier drops it, telemetry shows the reason code.
3. **Refine-not-restart as a diff.** A claim-graph diff rendered live: unchanged grey, added green, superseded struck through, citations preserved, one targeted query instead of three.
4. **Honesty about limits.** One rehearsed failure case in the video where the system correctly says "not found in the corpus" — teams that show their own edge cases are trusted more than teams that only show success.

## Why streaming is the core, not a feature

Current voice-agent stacks have STT, TTS, and LLM time-to-first-token all under ~200 ms. Retrieval (50–300 ms + network) is the last latency wall — this is stated in open-source voice-runtime READMEs, and it is the reason the entire product exists.

## The future-work line (state it, do not build it)

The retrieval side is small enough to run on a Galaxy-class device: bge-small ≈ 33M params, MiniLM reranker ≈ 22M, spaCy-sm ≈ 12 MB. Only synthesis needs the cloud. This mirrors Galaxy AI's hybrid on-device/cloud pattern. Say this with the numbers; do not attempt to build it in the hackathon window (ADR-0008).

## Judge Q&A — one-line answers (full table: `prelude.md` Section 5)

| Question | Answer |
|---|---|
| Mid-sentence topic change? | Embedding drift cancels the provisional query, re-fires on the new anchor — edge case #1, with the trace, in the report. |
| Fabricated citations? | Allow-list = this turn's retrieval set, quote must match verbatim, NLI entailment. Zero by construction, proven by the scorecard. |
| Latency breakdown? | Features ≈ 20 ms, hybrid search ≈ 30 ms, rerank ≈ 60 ms, NLI ≈ 40 ms, LLM ≈ 1 s streamed; each service hop 1–3 ms. |
| 10 000 documents? | Qdrant HNSW is sub-linear; rerank only touches top-20; ingestion is one-time and batched. |
| Why no LLM in the controller? | 300+ ms per 0.8 s chunk — the guide's own pitfall #1. Rules are deterministic and every decision logs a reason code. |
| How much better than baseline? | State the actual scorecard number. Never "much better." |
| Where does session data go? | Redis, 30-min TTL, session id only, no user identity, hashed ids in telemetry — proven by a TTL-expiry test. |
| How much of the code is AI? | It's in the AI Disclosure form, feature by feature — then walk through whichever function is pointed at. |
| Why not LangGraph / multi-agent? | Parsimony is scored; agents add non-deterministic latency, and the model never owns a decision in this design (ADR-0008). |
| Why not a 1M-token context window? | Breaks corpus isolation and per-claim citation, cost explodes per turn, no early-retrieval story. |

## The sentence to remember

**Everyone has the same theme; the team that pitches it as a product, proves it with numbers, and names its own limits wins.**
