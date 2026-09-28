# Prelude dashboard — frontend build brief

You are building the web dashboard for Prelude, a streaming RAG engine positioned as
Live Agent Assist for voice support. The code lives in `services/web/` (React + Vite + TS).
It is a hackathon submission; a judge will watch it on a projector for ~4 minutes, then
open the repo and ask both team members to explain any component.

The dashboard has two audiences at once: the support agent (in the story) and the judge
(in the room). The agent needs a calm, cited answer. The judge needs to see the engine
deciding, and why. Design for both on one screen without letting either one drown the other.

## Read before writing any code

1. `documentation/prelude.md` — sections 1, 3, 5, 9 (F12, F13, F14, F16, F18) and 4 (guardrails).
2. `schemas/events.schema.json`, `schemas/telemetry.schema.json`, `schemas/output_record.schema.json`
   — derive TypeScript types from these (json-schema-to-typescript or hand-written, kept in
   `src/types/`). Do not invent event shapes.
3. `services/gateway/app/api/` — the real routes: session create, chunk ingest, event stream
   (SSE or WS, use what exists), telemetry verify, health, replay/simulator. If something the UI
   needs is missing, list it at the end of your work as a gateway TODO; do not stub it in the web.
4. `evaluation/streams/*.jsonl` and `trajectories/` — read to understand shapes only.
5. `.github/workflows/ci.yml` — note the hardcode-grep. Nothing from `corpus/` or `evaluation/`
   (queries, answers, document IDs, quotes) may appear in `services/web/src`. Test fixtures must
   be synthetic and schema-valid.
6. `deploy/nginx/` — the web is a static Vite build served by nginx. Keep it that way.

Then, before building, write `services/web/DESIGN.md`: a token set (colors, type, spacing), the
final wireframe, and five principles. Review it against this brief and against the "generic
defaults" list below, revise, and only then build. The team will cite DESIGN.md in the AI
Disclosure form.

## The product claim the UI has to make visible

"Retrieval that starts before the question ends." Everything on screen serves one of these:
- Earliness, measured: where the controller fired vs. where it would have been safe to fire.
- Decisions with reasons: Wait / Retrieve / No-Retrieval, each with a reason code and a plain sentence.
- Verifiable claims: every claim carries `[Doc_ID §Section]` and a verbatim quote; the verifier
  can only subtract.
- Refine, not restart: a new detail updates affected claims as a diff; the rest stays.
- Known limits: "not in the corpus" is a designed state, not an error.

## Layout (desktop-first; projector at 1920×1080, laptop at 1440×900)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Prelude    session 9f2a…(hashed)   mode: replay / offline   gateway ok   28:41 │  header, one quiet row
│                                                    cost $0.00   [Tour]  [Mic]  │
├───────────────────────────────────────────────────────────────────────────────┤
│  My Galaxy S24 stopped charging after the update, and I bought it in Dubai ▍  │  transcript band (dark)
│  ├──┼──┼──┼──┼──◇────●──┼──┼──┼──┤            headroom 640 ms                   │  chunk ticks; ◇ safe, ● fired
│  wait  wait  wait   Retrieve: entity + clause end                              │  decision strip
├─────────────────────────────────────┬─────────────────────────────────────────┤
│ Answer   v2  (diff from v1)         │ Engine                                   │
│                                     │ Controller   ● Retrieve                  │
│ = Charging faults after One UI…     │   ENTITY_ANCHOR + CLAUSE_END, drift 0.08 │
│   [Doc_012 §3]  in set ✔ quote ✔ NLI ✔ │ Sub-queries (3 of 4 max)              │
│ + Devices bought outside India…     │   charging fault · done · k=8 · 94 ms    │
│   [Doc_007 §2]  ✔ ✔ ✔               │   warranty abroad · done · k=6 · 88 ms   │
│ − Standard warranty covers…  (struck)│   update rollback · cached · 3 ms       │
│   [Doc_003 §1]  superseded by Doc_007│ Latency  feat 20 │ search 30 │ rerank 60│
│                                     │          NLI 40  │ LLM 1.1 s streamed    │
│ Not in the corpus                   │ Verifier  1 claim dropped ▸              │
│   Whether a Dubai receipt is enough │ Telemetry  chain verified ✔ 142 events   │
│   → asks: "Do you have the invoice?"│ [event log, filter by trace, verify]     │
└─────────────────────────────────────┴─────────────────────────────────────────┘
```

- Header: session id (already hashed by gateway), AI_MODE and ML_BACKEND badges read from the
  gateway health payload (never hardcoded), per-service health, TTL countdown, cost, Tour, Mic.
- Transcript band spans full width; it is the hero. Answer column ≈ 58%, Engine ≈ 42%.
- Evidence drawer slides over the Engine column when a citation is opened. Esc closes it.
- Below 1024px stack the columns; below 768px don't bother.

## Components, with acceptance criteria (M = must, S = should, C = could)

**Transcript band (M).** Renders like broadcast live captions: large type (22/30), finalized
words at full weight, interim words at ~55% opacity, a caret at the live edge. Chunk boundaries
are not shown in the text; they are shown on the ruler beneath. Handles 10 chunks/s without
layout shift (fixed line height, no reflow of finalized text). One utterance at a time; previous
utterances collapse into a short history rail above, each with its decision summary.

**Headroom ruler (M).** Under the transcript, one horizontal time axis per utterance
(x = ms since utterance start). Chunk arrivals are ticks. Two markers: hollow = the offline
stabilisation point (provisional top-k overlapped final top-k ≥ 60%), filled = when the
controller actually fired. The gap is labelled in ms. Hovering a tick shows that chunk's
features: entities found, embedding drift, clause boundary, content-token count. A cancelled
provisional retrieval (self-correction, e.g. "Pune… actually Mumbai") shows as a struck marker
with reason `DRIFT_CANCEL`. Hand-rolled SVG; no chart library. Show the safe marker only when
the gateway supplies it (it comes from the eval/replay path); in live mode show only the fired
marker and say "headroom available in replay/eval".

**Decision strip (M).** Under the ruler: one cell per chunk with the controller decision. Wait is
quiet, Retrieve is the accent, No-Retrieval is neutral. Each cell shows the reason code in mono
and, on hover or focus, the plain sentence and the thresholds that produced it
(`"Fired: a device name appeared and the clause ended (drift 0.08 < 0.35)"`). Reason strings
come from the event payload; the UI only formats them.

**Answer panel (M).** The answer is a list of claims, not a paragraph. Each claim row:
claim text, one or more citation chips formatted exactly `[Doc_ID §Section]`, and a three-step
verifier trail: in retrieval set → quote found → entailed, each ✔ or ✘. Claims stream in as
they arrive. Version tabs (v1, v2, …) with a "diff from previous" toggle on by default:
unchanged claims muted, added claims marked `+` with a green tint, superseded claims marked `−`,
struck through, red tint, citations preserved. Under the version tab show what it cost to get
there: "1 targeted query, not 3" or "re-rendered from stored claims, 0 retrievals". A prose
toggle renders the same claims as a paragraph for the agent view; citations stay inline.

**Uncertainty block (M).** Its own block at the end of the answer, visually distinct from
errors (dashed rule, muted violet, never red). Two sub-states from the payload: "Not in the
corpus" with the unresolved sub-question, and the clarification question the engine asks when
a sub-intent has no evidence. This block is a success state; design it that way.

**Dropped-by-verifier section (M).** Collapsed by default beneath the claims: "1 claim dropped
by the verifier". Expanded: the claim text, which step failed, and the reason
(`ID not in this turn's retrieval set: Doc_999`). This is the injected-chunk moment; the tour
spotlights it.

**Evidence drawer (M).** Opens from a citation chip. Shows: document title, `Doc_ID §Section`,
version and effective-date metadata, a "superseded by …" badge when applicable, the full chunk
with the verbatim quote highlighted with `<mark>`, and provenance: which sub-query retrieved it,
BM25 rank, dense rank, RRF score, rerank score, cache hit or not. Everything here is from the
payload; document names come from the judge's corpus, never assumed.

**Controller lamp (M).** Top of the Engine column. Large state word readable from 3 m
(Wait / Retrieve / No-Retrieval), current reason code, and a small list of the features it
evaluated on the latest chunk. Changes with a 150 ms cross-fade; no pulsing.

**Sub-query fan-out (M).** The decomposition: the utterance at the top, up to 4 sub-queries
beneath with thin connectors. Each: text, status (queued → searching → reranking → done, or
cancelled), top-k count, latency, cache-hit badge (speculative cache reuse). A merged near-duplicate
shows as one row with "merged 2". Not a force graph; a compact list.

**Latency waterfall (M).** Horizontal bars per stage from the trace spans (features, hybrid
search, rerank, NLI, LLM first token, LLM complete) with ms labels and wall-clock total.
Hand-rolled SVG.

**Telemetry pane (M).** Virtualized event list (time, trace id, event type). Filter by trace id;
click an event for the raw JSON. A "Verify chain" button calls the gateway's verify endpoint and
shows "verified, N events" or "broken at event k". "Export JSONL" downloads the session's
events. Cost meter lives here: tokens in/out, $ this turn, $ this session, model names; in
replay/offline mode it reads "$0.00 (replay)".

**Mic mode (M).** Web Speech API with `interimResults = true`; each interim delta is posted as a
chunk with a client timestamp. Visible mic state (idle / listening / sending). Where the API is
unavailable (Firefox, some Chromium builds), fall back to a typing field that emits chunks
word-by-word on a timer, so the judge can still take the mic without a microphone. Keyboard: M
toggles mic, T starts the tour, Esc closes drawers.

**Guided tour (S, but build it right after M).** One button. It asks the gateway to replay a
committed stream in replay/offline mode (no API key), and overlays step captions with a
spotlight on the relevant panel. Steps, in order: retrieval fires mid-sentence; one sentence
fans out to parallel sub-queries; a late detail refines two claims (diff); "say that again,
shorter" re-renders with zero retrieval; the verifier drops the injected chunk; a question the
corpus can't answer; the self-correction cancel; then "Your turn — take the mic". Captions
describe what to look at; they never contain transcript text, answers, quotes or document IDs
(those come from the stream at runtime). Steps advance on the matching event type, with manual
next/back.

**Privacy notice (S).** Small footer line: "Session state lives in Redis for 30 minutes, keyed by
session id only. No user identity is stored. Telemetry hashes session ids. Raw logging is off."
Plus a first-visit dialog with the same text and a link to SECURITY.md. When the TTL expires,
the dashboard says "Session expired; nothing was kept" and offers a new session.

**Evidence graph (C).** Only if everything above is done and tested: claims ↔ chunks ↔ documents
for the current answer, superseded edges greyed. react-force-graph-2d is acceptable here and
nowhere else.

## Moments the UI must make legible without narration

1. Retrieval fires while the sentence is still being spoken — visible on the ruler and the lamp.
2. One sentence → up to 4 parallel sub-queries — visible in the fan-out.
3. A late detail changes two claims and the rest stays — visible as the diff, with
   "1 targeted query, not 3".
4. A presentation turn ("shorter") produces No-Retrieval and "0 retrievals" — visible on the lamp
   and the version tab.
5. The verifier drops a claim citing an ID that is not in the retrieval set — visible in the
   dropped section, with the reason.
6. An off-corpus question ends in "Not in the corpus" — visible in the uncertainty block.
7. Headroom: safe point vs. fired point, one number — visible on the ruler.
8. A mid-sentence correction cancels the provisional query — visible as the struck marker.

If any of these needs the presenter to explain it, the design is not finished.

## Visual direction

Ground it in the subject: live captions and a call-centre console, with a nod to the name —
the ruler reads left to right like a score, and the fired marker is a bar line. It is an
instrument, not a marketing dashboard.

- Two materials on one screen. The transcript band is the only dark element: ink
  `#1C232B` (blue-grey, not black), white captions, thin light strokes for the ruler. Everything
  else is light: a cool console white `#F3F4F2` for the Answer column, a slightly toned bench
  grey `#E8EAE6` for the Engine column, separated by a 1px rule `#CFD3CC`, not by shadows.
- One accent, spent in one place: signal blue `#2F6BFF` for the fired marker, the caret, the
  Retrieve state, and the primary button. Nothing else is blue.
- Semantic colors, always paired with a glyph or a word so color is never the only carrier:
  Wait amber `#B7791F`, No-Retrieval grey `#6B7280`, supported green `#1F7A4D`, dropped red
  `#B3261E`, uncertain violet `#6B5CA5`. Diff tints: added `#E6F4EC`, superseded `#FBEAEA`.
  Check every pairing for AA contrast and adjust.
- Type: one family with a mono sibling — IBM Plex Sans and IBM Plex Mono, self-hosted woff2 in
  `assets/fonts/` (no runtime CDN; the demo may run offline). Scale: captions 22/30, claims
  16/24, UI 14/20, timestamps 12/16. Mono is reserved for things a person scans character by
  character: document IDs, reason codes, trace ids, raw JSON. Not for labels, not for headings.
- Sentence case everywhere. No all-caps eyebrows, no tracked-out labels, no middle-dot
  separators in the header, no arrow glyphs appended to buttons.
- Structure carries meaning: 1px rules and indentation, not cards. Panels are square-cornered;
  chips and buttons 4px; the drawer 8px. No drop shadows except the drawer.
- Motion, exactly four: the caret, the fired marker dropping onto the ruler, the lamp
  cross-fade, and the diff transition (strike-through draws, new claim slides in). Each ≤ 200 ms.
  Nothing else animates. Respect `prefers-reduced-motion`.
- Dark mode: only if it falls out of the tokens for free. Do not spend time on it.
- Copy: plain verbs, sentence case. Errors say what happened and what to do
  ("Gateway unreachable at :8080. Retrying in 3 s."). Empty state: "No session yet. Start the
  tour or take the mic."

Generic defaults to avoid (they read as templated): cream background with terracotta accent;
near-black with acid green; identical rounded cards with the same soft shadow; gradient
washes; a fade-up entrance on every panel; hover transitions on every row.

## Engineering constraints

- React 18, Vite, TypeScript strict. No component library. CSS variables in `src/tokens.css`;
  CSS Modules or Tailwind if the scaffold already has it. Both team members must be able to
  explain every file, so prefer boring code over clever abstractions.
- One store (Zustand or `useReducer`): events in → normalized state out
  (session, utterances, chunks, decisions, subQueries, answerVersions, claims, verifierResults,
  traces, telemetryEvents, cost). The reducer is pure and unit-tested with synthetic fixtures.
- Transport: whatever the gateway exposes; SSE preferred for the event stream, POST for chunks.
  Reconnect with backoff; show connection state in the header. Replay is started via the
  gateway (`?stream=<name>` or equivalent), never by bundling stream files.
- Bundle ≤ 400 KB gzipped. Virtualize the telemetry list. Memoize claim rows. The web image must
  not push `make up` past 90 s.
- Tests (Vitest + Testing Library): the event reducer, the diff renderer (v1→v2 produces the
  right +/−/= rows with citations preserved), the citation-chip parser, and the Web Speech
  fallback path. Tests use synthetic fixtures only.
- Accessibility: AA contrast, visible focus rings, full keyboard operation, `aria-live="polite"`
  on the answer region only (the transcript is too chatty for a screen reader).
- Capture screenshots of moments 1, 3, 5 and 7 into `assets/` for the README and the PPT.

## Non-goals

No auth, no admin, no corpus editor, no cross-session history (the guide forbids profiling),
no chat-style UI, no charting library, no evidence graph until M and S items are done.

## Definition of done

Run `make up`, open the dashboard, press Tour: all eight moments are visible in replay/offline
mode with no API key. Press Mic (or use the typing fallback), ask something off-corpus, and get
a graceful "Not in the corpus". `npm test` passes. DESIGN.md matches what was built. List any
gateway endpoints or event fields the UI needed but could not find.