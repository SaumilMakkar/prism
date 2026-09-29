# PPT Outline

<!-- Content for each slide of the Samsung template. The deck itself is built in the template, not here. -->

Stay inside the mandatory Samsung template. File name: `CollegeName_TeamName_Submission`. Deck must be readable in 3 minutes (`prelude.md` Section 4) — this outline gives content, not layout; the template dictates layout.

## Slide 1 — Problem + hook
- One line: "Retrieval is the last latency wall in voice AI — everything else is already under 200 ms."
- One demo screenshot: the dashboard mid-answer, controller lamp lit, a claim streaming in with its citation visible.
- No architecture, no team intro here — this slide exists to make a judge lean in within 10 seconds.

## Slide 2 — Product framing: Live Agent Assist
- Scenario line (customer + agent screen, answer forms while speaking).
- Category grounding: Google CCAI Agent Assist, Cresta, Observe.AI — this is a real product category with a real buyer.
- Samsung-native hook: customer-care scale, every second of handling time is cost.

## Slide 3 — Architecture (the one architecture slide)
- `documentation/diagrams/architecture.svg` (rendered from `architecture.mmd`), unmodified.
- Five services + Qdrant + Redis, one `docker compose up`.
- One callout: hop cost 1–3 ms, measured by `make bench` — the "receipts" line from ADR-0001.

## Slide 4 — Differentiator 1: Measured earliness
- The stabilisation-headroom chart: two markers per utterance (safe point vs. fired point), gap distribution.
- One number, stated plainly (from the actual scorecard once run).

## Slide 5 — Differentiator 2: Verifiable claims
- Claim → citation → verbatim quote → verifier pipeline, shown as a 3-step subtract-only diagram.
- The injected-chunk moment: retrieved, cited attempt, rejected, reason code shown.

## Slide 6 — Differentiator 3: Refine-not-restart
- The claim-graph diff screenshot: grey / green / struck-through, from Example 2.
- One line: "one targeted query instead of three."

## Slide 7 — Numbers slide (the one numbers slide)
- G1–G6 scorecard table with ✔/✘ and internal targets vs. achieved.
- Latency breakdown table (features / hybrid search / rerank / NLI / LLM).
- Baseline comparison + two ablations (hybrid vs. dense-only; rule controller vs. logistic-regression controller) in one compact chart.

## Slide 8 — Honesty: what it can't do
- The one rehearsed failure case: off-corpus question → graceful "not found in the corpus."
- One line on a known limitation (e.g. no incremental re-ingestion in v1).

## Slide 9 — What's next (future work, not built)
- On-device retrieval path with real model-size numbers (bge-small ≈ 33M, MiniLM ≈ 22M, spaCy-sm ≈ 12 MB).
- MCP adapter for other voice-agent stacks (if built as the optional flourish, show it here instead as a shipped feature).

## Slide 10 — Team + AI disclosure line
- One line acknowledging Claude Code for implementation under team review, pointing to the full AI Disclosure form — do not over-explain here, the form is the artifact of record.
- Close on the sentence to remember: "Everyone has the same theme; the team that pitches it as a product, proves it with numbers, and names its own limits wins."

## Rules

- No slide beyond what's listed above without cutting one first — the guide's 3-minute readability bar is a hard constraint, not a target.
- Every number on Slides 4 and 7 must trace back to `evaluation/results/scorecard.md` — no number is typed by hand into the deck.
