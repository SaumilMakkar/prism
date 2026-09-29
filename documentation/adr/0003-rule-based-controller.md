# ADR-0003: Rule-based controller

**Status:** Accepted

## Context

The controller decides, per incoming transcript chunk (~0.8 s of speech), whether to Wait, Retrieve, or take No-Retrieval action. This is the hottest path in the system — it runs on every chunk, not just at utterance end — and it is also the path most visible to judges (Section 2 of `prelude.md`: "every controller decision visible with its reason"). The guide's stated pitfall #1 is putting an LLM in this loop: at ~300 ms per call against an 0.8 s chunk cadence, an LLM-based controller cannot keep up with speech and would itself become the latency wall the whole product exists to remove (Section 1).

## Decision

The controller is a deterministic rule policy (v1) over per-chunk features computed by `ml-service`: named-entity presence/change, embedding drift between successive buffers, clause-boundary detection, and a minimum content-token count. Each rule fires a `Wait | Retrieve | No-Retrieval` decision with an attached reason code (e.g. `ENTITY_STABLE_CLAUSE_END`, `DRIFT_ABOVE_THRESHOLD`, `PRESENTATION_TURN`); reason codes are what the dashboard shows live (F1, F12) and what telemetry logs (F10).

A logistic-regression classifier trained on the same features is built as **ablation 2** (F1, Section 9): same feature set, learned weights instead of hand-set thresholds, same reason-code contract so the dashboard and telemetry are unaffected. It is never the default — it exists to show, with numbers, what a marginally more complex policy buys (or does not buy) over rules, per the "measured, not claimed" differentiator (Section 3.1).

Mid-utterance topic change ("Pune… actually Mumbai" in Section 5) is handled inside this same rule set: embedding drift between successive buffers above threshold cancels the in-flight provisional query and re-fires retrieval on the new anchor, rather than being a special case bolted on separately.

## Consequences

- Every decision is O(feature computation) — no network call to an LLM — keeping the per-chunk path inside the `gateway ↔ ml-service` hop budget from ADR-0001.
- Thresholds (drift cutoff, minimum content tokens, clause-boundary confidence) are tuned by hand on the labelled evaluation streams (F15) and must be justified in the brief with the headroom curve (Section 3.1), not asserted.
- Because it is rules, every decision is explainable by reason code alone — this directly serves the AI-code-check moment in judging (Section 2, row 5: "does this team understand its own system").
- The classifier ablation must not become the demo default even if it scores marginally better — the guide's own pitfall framing means judges will specifically probe "is there an LLM in your controller," and the answer must stay "no" for both the rule policy and its ablation.
- Presentation-turn suppression (F8, ADR triggered by `PRESENTATION_TURN`) is a No-Retrieval branch of this same controller, not a separate component — "say that again, shorter" must re-render from the claim graph with zero retrieval and zero LLM call.
