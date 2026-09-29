# Evaluation Benchmarks

<!-- SOURCE. Generates Evaluation_Benchmarks.pdf next to the scripts. -->

Outline modelled on last year's winning submission's benchmark PDF (`prelude.md` Section 8) — objective, setup, dataset, categories, metrics, results, findings, discussion, architectural implications, limitations, related-work comparison, per-component latency, false-positive analysis. Every number below is copied from a real `make eval` run or from the gateway's telemetry log of that run; nothing is hand-typed — see [ADR-0007](../documentation/adr/0007-llm-choice-and-replay.md) on why offline/replay makes re-running this cheap and repeatable. `evaluation/results/scorecard.md` remains the single source of truth; if it changes, this file is regenerated from it.

## 1. Objective

Measure whether Prelude's speculative retrieval, hybrid search, claim-based synthesis, and subtractive verification meet the theme's six gates (G1–G6) against a labelled benchmark, and quantify — not just claim — how early retrieval was safe to fire.

## 2. Setup

- Run on 2026-09-29 through the full `docker compose` stack (nginx → gateway → ml-service / vector-service / ai-service, Qdrant, Redis), the eval-runner container driving every stream through `http://nginx/api` exactly as the dashboard does.
- Modes: `ML_BACKEND=hash` (deterministic hash embedder, lexical reranker, lexical NLI heuristic — no model download) and `AI_MODE=offline` (deterministic provider, no API key). The numbers therefore measure the pipeline's *mechanics* — controller, fusion, rerank ordering, verifier, claim graph — not a particular LLM's answer quality. A `MODE=live` run is the same command with a key.
- Hardware: a Windows 11 laptop running Docker Desktop (WSL2); nothing is GPU-bound in this configuration.
- Harness: `evaluation/harness/`, scoring pure and unit-tested separately from the HTTP client.

## 3. Dataset

Demo corpus: 6 sectioned markdown documents, 17 retrievable sections after ingestion (the superseded policy version is excluded from the index by design) — Galaxy device troubleshooting, warranty and return policy (two versions, one superseded), SmartThings setup, service-centre SLAs, one section with intentionally no coverage, one injected adversarial chunk. Generated, then hand-checked by the team (`prelude.md` Section 1). `prelude.md`'s original 40–60 target is aspirational scale, not yet reached. Judges bring their own corpus for scoring; this dataset is what the team's own numbers in this report are computed against.

## 4. Query categories

`simple`, `compound`, `late_detail`, `no_evidence`, `noise`, `presentation`, `adversarial` — see `evaluation/README.md` for what each tests and which gate it maps to. 7 streams, one per category. (Until 2026-09-29 the adversarial stream sat outside a category folder and was silently skipped by the harness; it is now scored.)

## 5. Metrics

| Metric | Definition | Maps to |
|---|---|---|
| Stabilisation headroom | Gap between offline-labelled safe-retrieval chunk and the chunk the controller actually fired on | G2 |
| Citation support % | Fraction of claims with a verified citation (allow-list + quote match + entailment) | G4 |
| Fabricated ID count | Claims citing an ID outside this turn's retrieval set that reach `verified` | G4 (must be 0) |
| Multi-intent coverage | Distinct sub-intents produced for labelled compound queries vs. the labelled minimum | G3 |
| Session continuity score | A refinement turn keeps at least one verified claim across the claim graph | G5 |
| Trace coverage % | Fraction of decisions (controller + verifier) with a logged trace and reason code | G6 |
| False-positive rate | `no_evidence` streams that end with a verified claim instead of `uncertainty` | G4 cross-check |

Recall@k / NDCG@5 and RAGAS are listed in the plan but not computed by the harness as built.

## 6. Results

From `evaluation/results/scorecard.md`, generated 2026-09-29T06:00:25Z over 7 streams.

| Gate | Target | Internal target | Result | ✔/✘ |
|---|---|---|---|---|
| G1 | Reproducibility | 90 | 100.0 | ✔ |
| G2 | ≥ 80% | 85 | 100.0 | ✔ |
| G3 | ≥ 70% | 95 | 100.0 | ✔ |
| G4 | ≥ 85%, 0 fabricated | 100 | 100.0 (0 fabricated) | ✔ |
| G5 | — | 100 | 100.0 | ✔ |
| G6 | 100% | 100 | 100.0 | ✔ |

Mean headroom (fired chunk − safe chunk): **0.14 chunks**. False-positive rate on `no_evidence`: **0.0%**. Hash-chained telemetry verified intact after the run (G1).

## 7. Ablations

1. **Hybrid vs. dense-only retrieval** — wired as `make eval-ablation` (gateway recreated with `HYBRID_ENABLED=false`, scorecard written to `scorecard_dense_only.md`). Not yet run for this report; the number goes here when it is.
2. **Rule-based vs. logistic-regression controller** — the logistic-regression policy is not built; no comparison number exists.

## 8. Findings and discussion

- **The controller fires at or just after the safe point, never before.** Mean headroom is 0.14 chunks across 7 streams and no stream fired early; on the mid-sentence self-correction stream the provisional retrieval is cancelled and re-anchored (`DRIFT_ABOVE_THRESHOLD_REANCHOR`) rather than answered.
- **Verification is where the real bugs showed up, not synthesis.** Three defects were found only by running the stack end to end, all fixed with a regression test: a citation-id collision between a superseded and a current policy version that double-counted in RRF; a telemetry hash chain that broke on gateway restart; and an entity fallback that never fired on lowercase transcripts, leaving the controller stuck on `NO_STABLE_ENTITY`.
- **The offline provider's first false positive came from the `no_evidence` stream:** a single shared word made an unrelated SLA chunk look like evidence. Overlap is now measured against the question's own content words with a minimum ratio, and the stream ends in `uncertainty`.
- **The adversarial chunk cannot reach `verified` even when it is legitimately retrieved:** its instruction text never quote-matches a real claim, so it is dropped with a reason code the dashboard shows in the "dropped by the verifier" section.
- **Session semantic cache saw 0 hits of 12 retrievals** in this run — the seven streams do not repeat a sub-query. Hits appear in interactive use when a detail is re-asked; the fan-out shows them as "cached" with the similarity.

## 9. Architectural implications

- With the hash backend, **retrieval is the dominant line item (median 137 ms)** because one sub-query costs four HTTP hops (embed for the cache, BM25 + dense in vector-service, rerank in ml-service). Under the transformer backend the rerank call itself becomes the cost, which is what the latency budget in the Architecture Brief assumed; the hop structure, not the model, is what the hash run measures.
- The verifier's cost (median 33 ms per claim, one NLI call) is small enough that "every claim is checked" holds without batching.
- Hybrid retrieval's advantage cannot be read from this run alone — see ablation 1.

## 10. Limitations

- 7 streams, one per category: enough to prove each mechanism, not enough for a distribution. Gate percentages are therefore 0 or 100 per stream.
- Hash backend and offline provider: retrieval quality and answer quality are not what this run measures; a `MODE=live` run with the transformer backend is required for those.
- No Recall@k, NDCG or RAGAS in the harness.
- The safe-point labels are hand-assigned per stream (two were corrected after the first run); an offline top-k-overlap computation of the safe point is designed but not implemented.

## 11. Comparison to related work

Enterprise Agent Assist products do not publish an early-retrieval metric or a subtractive citation-verification mechanism; this report's headroom and fabricated-ID numbers are the concrete artifacts that distinguish Prelude's claims from a slide-only comparison.

## 12. Per-component latency

Measured from the gateway's telemetry log for the run in Section 6 (`latency_ms` per event, wall-clock inside the gateway, hash backend, offline provider):

| Stage (event) | n | median ms | p95 ms | max ms |
|---|---|---|---|---|
| Controller (features + policy) | 22 | 26.2 | 43.1 | 54.3 |
| Decompose | 11 | 29.9 | 35.9 | 55.8 |
| Retrieval (embed, BM25 + dense, RRF, rerank) | 12 | 137.2 | 261.1 | 295.2 |
| Synthesis | 12 | 43.9 | 68.0 | 75.7 |
| Verify (per claim, incl. NLI call) | 5 | 32.8 | 40.4 | 46.3 |

These replace the *target* table in the Architecture Brief Section 6 for the hash configuration; the transformer configuration has not been measured.

## 13. False-positive analysis

- **Verifier passing an unsupported claim:** 0 in this run. Structurally impossible for an ID outside the retrieval set (allow-list), and the adversarial stream confirms the quote-match step catches an in-set injected chunk.
- **Verifier rejecting a well-supported claim:** not directly measured; G4 citation support at 100% on the labelled streams means no expected claim was lost.
- **Controller firing prematurely:** 0 streams with negative headroom.
- **`no_evidence` answered anyway:** 0.0%.
