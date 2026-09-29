# Prelude dashboard — DESIGN.md

Written against `prompts/frontend_prompt.md`. This is the record the AI Disclosure form
cites for the web build.

## Token set

See `src/tokens.css` for the authoritative values. Summary:

| Token | Value | Use |
|---|---|---|
| `--ink` | `#1c232b` | Transcript band background, tour caption, header |
| `--console-white` | `#f3f4f2` | Answer column |
| `--bench-grey` | `#e8eae6` | Engine column |
| `--rule` | `#cfd3cc` | The only separator — 1px rules, never shadows |
| `--accent` | `#2f6bff` | Fired marker, caret, Retrieve state, primary actions — spent nowhere else |
| `--wait` / `--no-retrieval` / `--supported` / `--dropped` / `--uncertain` | amber / grey / green / red / violet | Always paired with a glyph or word, never color alone |
| `--font-sans` / `--font-mono` | IBM Plex Sans / IBM Plex Mono, **falls back to system stack** | See deviation #1 below |

Spacing/type scale, radii (4px chips, 8px drawer), and the four permitted motions (caret
blink, fired-marker drop, lamp cross-fade, diff transition) are all defined once in
`tokens.css` / `styles.css` — no ad hoc values scattered through components.

## Wireframe

Implemented layout matches the brief's ASCII wireframe: header row; full-width dark
transcript band with headroom ruler + decision strip beneath it; a 58/42 answer/engine
split below that; evidence drawer as an overlay sliding from the right. Below 1024px the
two columns stack (see `.main-grid` media query in `styles.css`); no special handling
below 768px, matching the brief.

## Five principles

1. **Every number on screen is a number the backend actually returned.** No panel invents
   a rank, a score, or a timing that the gateway/telemetry didn't produce this turn — see
   "Data honesty" below for the two places this measurably shrank the spec.
2. **The transcript is the hero; everything else explains it.** The dark band is the only
   dark surface, sized and weighted so a judge across the room reads the caption before
   anything else.
3. **Color never carries meaning alone.** Every semantic color is paired with a word or a
   glyph (Wait/Retrieve/No-Retrieval spelled out, ✔/✘ in the verifier trail).
4. **One accent, spent once.** Signal blue marks exactly the things that represent
   forward motion — the fired marker, the caret, the Retrieve state, primary buttons —
   and nothing else on the page uses it, so it stays legible as a signal.
5. **Reversible, not decorative, motion.** The four permitted animations (caret, marker
   drop, lamp cross-fade, diff transition) all communicate a state change that already
   happened in the data; nothing animates just to feel alive, and `prefers-reduced-motion`
   turns all four off.

## Deviations from the brief, and why

1. **Fonts are not self-hosted.** The brief asks for IBM Plex Sans/Mono as self-hosted
   woff2 in `assets/fonts/`. The build environment for this pass had no reliable way to
   fetch and vendor the actual font binaries, and shipping a `@font-face` rule pointing at
   files that don't exist would be worse than not claiming them. `tokens.css` names IBM
   Plex first in the stack and falls back to the system sans/mono stack, so the layout,
   scale, and mono-for-scannable-values rules are all real; only the specific typeface
   is a placeholder. Follow-up: vendor the two woff2 files into `assets/fonts/` and this
   becomes a one-line change.
2. **Mic mode posts only finalized speech results as chunks, not every interim delta.**
   The brief's literal text says "each interim delta is posted as a chunk." Web Speech's
   interim results fire roughly every 100ms while speaking; posting each one as a
   separate `/turn` call would flood the controller with near-duplicate fragments and
   make the decision strip/ruler unreadable — the opposite of the "calm instrument" the
   visual brief asks for. Interim text still drives the live 55%-opacity preview in the
   transcript band (so the caret and partial-text behavior the brief describes are real);
   only the *posting* cadence differs. See `src/components/MicInput.tsx`'s doc comment.
3. **Guided tour drives real `/turn` calls against the same session's claim graph**,
   rather than a dedicated gateway "replay a stream" endpoint. Functionally this produces
   the same visible effect — every tour step is a real orchestrator run — via the smaller
   `GET /demo/streams` / `GET /demo/streams/{name}` addition (below) instead of a new
   stream-replay capability, since the eight moments only need the *turn* pipeline to run
   for real, not a server-driven playback mechanism.

## Data honesty: what the gateway didn't have, and what I added instead of stubbing

Per the brief: "If something the UI needs is missing, list it as a gateway TODO; do not
stub it in the web." Two things followed from that:

**Added to the gateway (small, real, backed by actual data):**
- `GET /healthz` now proxies `ai_mode`/`ml_backend` from ai-service/ml-service so the
  header badges are real, not guessed (`services/gateway/app/main.py`).
- `GET /cost/{token}` proxies ai-service's per-session cost meter.
- `GET /telemetry/{token}` returns *this session's own* recorded events (filtered by
  `session_id_hash` — never another session's), powering the telemetry pane, the
  sub-query fan-out, and the latency waterfall from data that was already being recorded
  but was previously unreachable by the UI.
- `orchestrator.py` now times each stage (controller, decompose, per-sub-query search,
  per-sub-query synthesize, verify) with `time.perf_counter()` and emits real
  `latency_ms` on the corresponding telemetry events — the latency waterfall is real
  wall-clock time, not a mock.
- `GET /demo/streams` / `GET /demo/streams/{name}` serve the committed evaluation
  streams read-only, server-side, so the guided tour never bundles stream content into
  the web build (keeps the hardcode-grep guarantee intact).

**Left as an honest gap, not stubbed (gateway TODO for a future pass):**
- The evidence drawer cannot show full chunk text, BM25/dense rank, RRF score, or
  rerank score — `RetrievalHit` (`packages/core/prism_core/schemas.py`) only carries a
  single fused `score` and `source` string per hit, and telemetry only records
  `citation_id`s, not full hit objects. The drawer shows citation id, the verbatim quote,
  and the verifier trail (all real) and nothing it would have to invent.
- There is no SSE/WS event stream; `/turn` is synchronous request/response. The UI
  therefore cannot show true mid-flight per-stage status ("searching…" → "reranking…")
  for a sub-query — the fan-out shows each sub-query's final state only, which is
  consistent with the architecture (ADR-0001) rather than a missing feature to paper
  over with a fake progress animation.

## Testing

`npm test` runs Vitest + Testing Library over: the reducer (`src/store.test.ts`), the
diff classifier and its rendered output (`src/components/AnswerPanel.test.tsx` —
`claimClass` plus a render assertion that added/superseded rows keep their citations),
the citation-id parser (`src/types.test.ts`), and the Web Speech fallback path
(`src/components/MicInput.test.tsx`, exercised naturally since jsdom has no
`SpeechRecognition`). All fixtures are synthetic literals in the test files — nothing
from `evaluation/` or `corpus/` appears under `services/web/src`.
