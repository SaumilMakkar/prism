# Evaluation Benchmarks

<!-- SOURCE. Generates Evaluation_Benchmarks.pdf next to the scripts. -->

Outline modelled on last year's winning submission's benchmark PDF (`prelude.md` Section 8) — objective, setup, dataset, categories, metrics, results, findings, discussion, architectural implications, limitations, related-work comparison, per-component latency, false-positive analysis. Every numeric section below is a placeholder until `make eval` has actually run; this file must never be hand-filled with invented numbers — see [ADR-0007](../documentation/adr/0007-llm-choice-and-replay.md) on why replay makes re-running this cheap and repeatable.

## 1. Objective

Measure whether Prelude's speculative retrieval, hybrid search, claim-based synthesis, and subtractive verification meet the theme's six gates (G1–G6) against a labelled benchmark, and quantify — not just claim — how early retrieval was safe to fire.

## 2. Setup

- Services run via `docker compose --profile eval up`.
- Harness: `evaluation/harness/`, executed via `make eval` (replay mode, no API key) or `make eval MODE=live`.
- Hardware/environment: *(fill in at benchmark time — CPU, RAM, whether run in CI or locally)*.

## 3. Dataset

Demo corpus: 40–60 sectioned markdown documents — Galaxy device troubleshooting, warranty and return policy (two versions, one superseded), SmartThings setup, service-centre SLAs, one section with intentionally no coverage, one injected adversarial chunk. Generated, then hand-checked by the team (`prelude.md` Section 1). Judges bring their own corpus for scoring; this dataset is what the team's own numbers in this report are computed against.

## 4. Query categories

`simple`, `compound`, `late_detail`, `no_evidence`, `noise`, `presentation` — see `evaluation/README.md` for what each tests and which gate it maps to. 40+ streams total.

## 5. Metrics

| Metric | Definition | Maps to |
|---|---|---|
| Stabilisation headroom | Gap between offline-computed safe-retrieval point (provisional/final top-k overlap ≥ 60%) and actual controller fire time | G2 |
| Recall@k / NDCG@5 | Standard retrieval quality over labelled relevant Doc_IDs | G4 input quality |
| Citation support % | Fraction of claims with a verified citation (allow-list + quote match + entailment) | G4 |
| Fabricated ID count | Claims citing an ID outside this turn's retrieval set | G4 (must be 0) |
| Multi-intent F1 | Correct sub-intent decomposition and coverage vs. labelled compound queries | G3 |
| Session continuity score | Correct affected-claim detection and citation preservation across a refinement turn | G5 |
| Trace coverage % | Fraction of decisions (controller + verifier) with a logged trace and reason code | G6 |
| RAGAS faithfulness / answer relevance | Standard RAGAS metrics over synthesized claims | G4 cross-check |

## 6. Results

*(Populate from `evaluation/results/scorecard.md` once `make eval` has run — do not hand-type numbers here.)*

| Gate | Target | Internal target | Result | ✔/✘ |
|---|---|---|---|---|
| G1 | Reproducibility | 90 | — | — |
| G2 | ≥ 80% | 85 | — | — |
| G3 | ≥ 70% | 95 | — | — |
| G4 | ≥ 85%, 0 fabricated | 100 | — | — |
| G5 | — | 100 | — | — |
| G6 | 100% | 100 | — | — |

## 7. Ablations

1. Hybrid vs. dense-only retrieval — retrieval quality and G4 delta.
2. Rule-based vs. logistic-regression controller — G2/headroom delta, latency delta.

*(Results populated post-run.)*

## 8. Findings and discussion

*(Fill in once results exist — what worked, what surprised the team, where the headroom curve was tighter or looser than expected.)*

## 9. Architectural implications

*(e.g. does the hop-cost budget hold under the eval load; does rerank stay the dominant latency line item; does hybrid retrieval's advantage hold across all query categories or only exact-identifier ones.)*

## 10. Limitations

See Architecture Brief Section 8 for the standing list; add anything specific to what the benchmark run itself exposed (e.g. a stream category that was harder to label reliably, a threshold that needed re-tuning after the first full run).

## 11. Comparison to related work

Enterprise Agent Assist products do not publish an early-retrieval metric or a subtractive citation-verification mechanism; this report's headroom and fabricated-ID numbers are the concrete artifacts that distinguish Prelude's claims from a slide-only comparison.

## 12. Per-component latency

Reused from `make bench` output — see Architecture Brief Section 6 for the target table; this section holds the measured table once available.

## 13. False-positive analysis

For G4: rate at which the verifier incorrectly moves a well-supported claim to `uncertainty` (false negative on support) versus incorrectly passes an unsupported claim (should be structurally zero by the allow-list design — report actual measured count as the proof). For the controller: rate of `Retrieve` firing on features that later prove premature (headroom goes negative).
