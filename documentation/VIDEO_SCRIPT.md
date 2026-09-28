# Video Script (5:00)

<!-- Timed script; mark every required moment with its timestamp. -->

Spine: the Guided Demo Tour (F14) — one button replays these beats with captions and the telemetry pane open, so the video is a recording of the real product, not a separate screen-record script.

| Time | Beat | What's on screen | Required moment? |
|---|---|---|---|
| 0:00–0:20 | Hook | One-line problem statement over the dashboard idle state: "Retrieval is the last latency wall in voice AI." | — |
| 0:20–0:45 | Architecture, fast | `architecture.svg`, 15 seconds, voiceover: five services, one compose up, hop cost 1–3 ms. | — |
| 0:45–1:30 | Example 1: early retrieval (Journey walkthrough) | Live mic input, controller lamp shows Wait → Retrieve with reason code, sub-queries fan out on screen, claims stream in with citations. | **Required: G2 in action** |
| 1:30–2:15 | Example 2: refine-not-restart | User adds a detail mid-conversation ("bought abroad"); claim-graph diff renders — grey/green/struck-through — one targeted query shown in the sub-query panel, not three. | **Required: G5 diff** |
| 2:15–2:45 | Example 3: presentation-turn suppression | "Say that again, shorter" — controller lamp shows No-Retrieval / `PRESENTATION_TURN`, answer re-renders instantly from the claim graph, zero retrieval in the telemetry pane. | **Required: No-Retrieval proof** |
| 2:45–3:30 | Verifiable claims + injected chunk | The injected `Doc_999` chunk is retrieved, the model attempts to cite it, the verifier rejects it live, telemetry shows the reason code (`ID_NOT_IN_RETRIEVAL_SET` or `QUOTE_MISMATCH`), claim shown as `uncertainty`. | **Required: G4 + security in one shot** |
| 3:30–4:00 | Honest failure | An off-corpus question is asked; the system responds "not found in the corpus" instead of guessing. | **Required: named limitation, Section 4 differentiator #4** |
| 4:00–4:30 | Numbers | Scorecard on screen: G1–G6 ✔/✘, latency table, one ablation chart (hybrid vs. dense-only). | **Required: benchmark proof** |
| 4:30–4:50 | Give the judge the mic (if live) / unscripted clip (if recorded) | Real, non-scripted input handled gracefully — either live in front of judges or as a clip in the video if pre-recorded. | Differentiator #5 |
| 4:50–5:00 | Close | Team + one-line AI disclosure pointer + "the sentence to remember." | — |

## Rules

- Every beat above must be a real interaction with the running system, captured via the Guided Demo Tour, not staged screen mockups — an AI-code-check-literate judge notices the difference.
- Stay at or under 5:00 total; trim beat length, not beat count — every row marked "Required" must survive any cut.
- Captions during the tour should show the reason code text, not paraphrase it — this is the same telemetry string the dashboard and the scorecard use, so it stays consistent across every artifact a judge sees.
