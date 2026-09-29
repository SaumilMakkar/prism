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
| `--accent` | `#2f6bff` | Fired marker, caret, Retrieve state, cache-hit badge, focus ring, primary actions — spent nowhere else |
| `--wait` / `--no-retrieval` / `--supported` / `--dropped` / `--uncertain` | amber / grey / green / red / violet | Always paired with a glyph or word, never color alone |
| `--font-sans` / `--font-mono` | IBM Plex Sans / IBM Plex Mono, self-hosted | Bundled from `@fontsource/ibm-plex-*` (woff2, latin subset); no runtime CDN |

Spacing/type scale, radii (4px chips, 8px drawer), and the four permitted motions (caret
blink, fired-marker drop, lamp cross-fade, diff transition) are all defined once in
`tokens.css` / `styles.css` — no ad hoc values scattered through components.

## Wireframe

Implemented layout matches the brief's ASCII wireframe: header row (hashed session id, mode
and ML badges, gateway state, TTL countdown, cost, Tour, Mic); full-width dark transcript
band with a three-line history rail above the live caption, headroom ruler + decision strip
beneath it; a 58/42 answer/engine split below that; evidence drawer as an overlay sliding
from the right. Engine column, top to bottom: controller lamp (with the evaluated
features), sub-query fan-out, latency waterfall, evidence graph (collapsible), telemetry
pane. Below 1024px the two columns stack; no special handling below 768px, matching the
brief.

## Five principles

1. **Every number on screen is a number the backend actually returned.** No panel invents
   a rank, a score, or a timing that the gateway/telemetry didn't produce this turn — see
   "Data honesty" below for what this ruled out and what was added to the gateway instead.
2. **The transcript is the hero; everything else explains it.** The dark band is the only
   dark surface, sized and weighted so a judge across the room reads the caption before
   anything else.
3. **Color never carries meaning alone.** Every semantic color is paired with a word or a
   glyph (Wait/Retrieve/No-Retrieval spelled out, ✔/✘ in the verifier trail, hollow vs.
   filled markers on the ruler, dashed vs. solid edges in the graph).
4. **One accent, spent once.** Signal blue marks exactly the things that represent
   forward motion — the fired marker, the caret, the Retrieve state, a cache hit, the
   focus ring, primary buttons — and nothing else on the page uses it, so it stays legible
   as a signal.
5. **Reversible, not decorative, motion.** The four permitted animations (caret, marker
   drop, lamp cross-fade, diff transition) all communicate a state change that already
   happened in the data; nothing animates just to feel alive, and `prefers-reduced-motion`
   turns all four off.

## Deviations from the brief, and why

1. **Headroom is shown in chunks, not milliseconds.** The brief's ruler labels the gap in
   ms. The safe point Prelude actually has is `expected_safe_chunk_index`, an offline label
   on each committed eval stream — the same quantity `make eval` scores for G2. The ruler
   draws chunk arrivals on a real ms axis (client-observed), a hollow marker at the safe
   chunk and a filled one at the fired chunk, and labels the gap in chunks ("2 chunks of
   headroom"). In live mic mode there is no safe label, and the ruler says "headroom
   available in replay/eval" rather than inventing one.
2. **Mic mode posts only finalized speech results as chunks, not every interim delta.**
   The brief's literal text says "each interim delta is posted as a chunk." Web Speech's
   interim results fire roughly every 100ms while speaking; posting each one as a
   separate `/turn` call would flood the controller with near-duplicate fragments and
   make the decision strip/ruler unreadable — the opposite of the "calm instrument" the
   visual brief asks for. Interim text still drives the live 55%-opacity preview in the
   transcript band (so the caret and partial-text behavior the brief describes are real);
   only the *posting* cadence differs. Each final result (and each typed line) is cut into
   clause-sized chunks of at most six words at punctuation and spoken connectives
   (`src/chunking.ts`, tested) and posted in order, so the ruler shows real ticks and the
   controller sees the clause boundary it fires on — the same shape as the eval streams.
   A trailing spoken "dot" / "period" / "question mark" becomes the punctuation mark.
   See `src/components/MicInput.tsx`'s doc comment.
3. **Guided tour drives real `/turn` calls against the same session's claim graph**,
   rather than a dedicated gateway "replay a stream" endpoint. Functionally this produces
   the same visible effect — every tour step is a real orchestrator run — via the smaller
   `GET /demo/streams` / `GET /demo/streams/{name}` addition (below) instead of a new
   stream-replay capability, since the eight moments only need the *turn* pipeline to run
   for real, not a server-driven playback mechanism.
4. **The evidence graph is a hand-laid three-column SVG, not a force graph.** The brief
   allows react-force-graph-2d here. A documents → chunks → claims ladder reads faster on
   a projector than a settling simulation, keeps the "no charting library" rule intact,
   and superseded/dropped edges (greyed dashed / violet dashed) stay legible because the
   layout does not move.

## Data honesty: what the gateway didn't have, and what was added instead of stubbing

Per the brief: "If something the UI needs is missing, list it as a gateway TODO; do not
stub it in the web." Everything below was added to the backend, backed by real data:

- `GET /healthz` proxies `ai_mode`/`ml_backend` from ai-service/ml-service and reports
  `session_ttl_seconds`, so the header badges and the TTL countdown are real.
- `POST /session/start` returns `session_ttl_seconds`; the header counts down from it and,
  at zero, the dashboard drops its state and shows "Session expired; nothing was kept."
- `GET /cost/{token}` proxies ai-service's per-session cost meter.
- `GET /telemetry/{token}` returns *this session's own* recorded events (filtered by
  `session_id_hash` — never another session's), powering the telemetry pane, the
  sub-query fan-out, and the latency waterfall.
- `controller_decision` events now carry `features` (anchors, drift, clause boundary,
  content tokens) — the ruler tooltips and the lamp's feature list read those.
- `retrieval_completed` events carry `cache_hit` / `cache_similarity` from the session
  semantic cache (F9) — the fan-out's "cached · sim 0.97" badge and the answer panel's
  "1 targeted query, 1 from cache" line read those.
- `/turn` responses carry `evidence`: this turn's retrieval hits with full chunk text,
  document title/version/effective date, BM25 rank, dense rank, RRF score, rerank rank,
  the sub-query that retrieved it, and cache hit. The evidence drawer and the evidence
  graph are built from that. A citation with no hit this session (the injected-chunk
  case) is shown as exactly that, never filled in.
- `GET /demo/streams` / `GET /demo/streams/{name}` serve the committed evaluation
  streams read-only, server-side, so the guided tour never bundles stream content into
  the web build (keeps the hardcode-grep guarantee intact). The tour passes each stream's
  `expected_safe_chunk_index` to the ruler for the hollow safe marker.

**Still an honest gap:**
- There is no SSE/WS event stream; `/turn` is synchronous request/response. The UI
  therefore cannot show true mid-flight per-stage status ("searching…" → "reranking…")
  for a sub-query — the fan-out shows each sub-query's final state only, which is
  consistent with the architecture (ADR-0001) rather than a missing feature to paper
  over with a fake progress animation.

## Appearance themes and the edge treatment

Added at the team's request after reviewing a reference landing page. Every colour is a
token in `src/tokens.css`; a theme only redefines those variables via `data-theme` on
`<html>`, chosen from the header's Appearance menu (`src/components/ThemeMenu.tsx`) and
remembered per viewer in localStorage. Eight appearances ship: **Paper** (default — warm
paper, ink, one gold accent; the front page's palette, below), **Obsidian** (the front
page's dark mode, same gold), **Light** (the brief's original two-material design,
unchanged), Mission Control, VS Code Dark, GitHub Dark, Blueprint, Catppuccin. A sun/moon
toggle next to the menu flips between Paper and Obsidian only; it writes the same
localStorage key the front page's toggle writes, so `/` and `/console` always open in the
mode the viewer last chose, and a one-line script in `index.html` applies the remembered
theme before first paint so neither page flashes the other mode. In Paper and Obsidian the
header row leaves the ink band and sits on the page colour (`--header-*` tokens), matching
the front page's nav; the transcript band stays the one dark surface.

The edge treatment is one rule applied to every card (`.engine-section`, `.lamp-block`,
`.telemetry-pane`, `.drawer`, the appearance popover): a flat surface, a 1px border, and
a 1px highlight along the top edge that fades at both ends, so panels read as lit from
above rather than floating on a shadow. Hover brightens the border and adds a soft accent
glow beneath. The primary button, the caret and the fired marker carry the same accent
glow. This is a deliberate deviation from the brief's "no drop shadows except the drawer"
line: the glow is the accent spent on the same forward-motion elements as before, and the
Light theme keeps the original look for anyone who prefers the brief as written.

## Motion (Framer Motion)

Motion is centralised in `src/motion.tsx` and keeps the principle above — it only marks a
state change that already happened in the data. What animates: the page arriving (fade
and 10px rise) and leaving (a `TransitionLink` plays a 220ms exit before `location.assign`,
since `/` and `/console` are separate document loads); a "Connecting to the gateway"
screen with the mark breathing until the first `/healthz` answer, then a cross-fade out;
claim rows rising in as they are added and fading as they are superseded (`AnimatePresence`
around the claim list); the controller lamp's verdict, where the previous word fades out
before the new one rises in; the evidence drawer sliding in from the right with its
backdrop fading; the tour caption and any banner; the appearance popover. On the front
page, the hero lines stagger in on load, sections rise into view once as they are scrolled
to, the engineering panel cross-fades between tabs and its chips stagger, and the sun/moon
icon rotates on flip. `MotionConfig reducedMotion="user"` turns every one of these into an
instant cut when the OS asks for reduced motion; the four CSS motions from the brief are
unchanged.

## Keyboard

`M` toggles the mic, `T` starts the tour, `Esc` closes any drawer or the tour. Shortcuts
are ignored while a text field has focus. Every control has a visible `:focus-visible`
ring; the answer region is `aria-live="polite"`, the transcript is not (too chatty).

## Testing

`npm test` runs Vitest + Testing Library over: the reducer (`src/store.test.ts` — chunk
bookkeeping, evidence accumulation, safe-chunk index, session expiry), the diff classifier
and its rendered output (`src/components/AnswerPanel.test.tsx`), the citation-id parser and
verifier-trail decoding (`src/types.test.ts`), the headroom label
(`src/components/TranscriptBand.test.tsx`), the evidence graph builder and render
(`src/components/EvidenceGraph.test.tsx`), the evidence drawer's quote highlighting and
"never retrieved" state (`src/components/EvidenceDrawer.test.tsx`), and the Web Speech
fallback path (`src/components/MicInput.test.tsx`). All fixtures are synthetic literals in
the test files — nothing from `evaluation/` or `corpus/` appears under `services/web/src`.

## The front page (`/`)

Added after the team reviewed a second reference landing page and asked for the same feel
in light mode. The bundle now serves two pages: the front page at `/` (`src/landing/`)
and the dashboard at `/console` (`src/App.tsx`), chosen by one pathname check in
`src/route.ts` — no router library, and the Vite dev server (which nginx proxies) already falls
back to `index.html` for any path.

**What it is.** A single scrolling page in the reference's structure — announcement strip,
sticky nav, split hero (headline left, mission / problem / apparatus right), a stats band,
four stacked "pillar" cards with a numbered stepper, a marquee of controller and verifier
vocabulary, the apparatus diagram, a tabbed engineering panel, a closing "proven headroom"
mark and a footer. The copy in `src/landing/content.ts` only says things the repo backs:
the four numbers are the README scorecard (6/6 gates, measured offline), the controller's
no-LLM guarantee, the service count and the `make up` target. No eval-stream text and no
adversarial document id appear (the hardcode grep covers `src/landing/` like everything
else under `services/`).

**Light first, dark as a flip.** The page is light ("paper": warm paper, ink, a single
gold accent, an italic serif for display lines) by default, with an "obsidian" flip in the
nav kept per viewer in localStorage. Both are token sets on `.landing[data-mode]` in
`src/landing/landing.css`; nothing in it leaks into the dashboard, and the dashboard's new
**Paper** appearance uses the same palette so the two pages feel like one product.

**The visuals are drawn, not generated.** No AI image or video generation was available
in the session that built this, so the page carries no raster media. The hero "film"
(`src/landing/HeroVisual.tsx`) is a looping SVG of one console turn — chunks arriving on a
millisecond ruler, the hollow safe marker and the filled fired marker, claims forming with
citations, a late detail superseding one claim and adding another — timed entirely by CSS
keyframes so `prefers-reduced-motion` freezes it on the final frame. It is labelled as an
illustration on the page; the console runs the real thing. The apparatus diagram
(`src/landing/Apparatus.tsx`) is the same idea for the architecture: inputs converge on
the gateway, one turn runs decompose → retrieve → synthesize → verify, the answer ships
only after the verifier passes, and the measured outcome is the headroom the ruler shows.
The transcript and claims in the film are synthetic; the document ids are public corpus
fixtures. If the team records the demo video (`documentation/VIDEO_SCRIPT.md`), the hero
figure is where it belongs.

**The console shares the signature.** After the front page landed, the dashboard took the
same type system so `/` and `/console` read as one product: the logo mark and a "Front
page" link in the header, badges, buttons and section labels in tracked mono (the front
page's eyebrow style), and the display serif on exactly two hero moments — the live
transcript line and the controller's verdict word ("Retrieve" / "Wait" / "No-Retrieval"),
plus the "Not in the corpus" title. Body copy, claims, quotes and every number stay in
Plex Sans / Plex Mono. This is a typographic change shared by all appearances; the rule
that a theme only redefines colour tokens still holds (`--font-display` lives once in
`:root`).

**The recording.** `public/media/console-demo.webm` (with its poster frame) is a screen
recording of `/console` in Paper mode, made with Playwright's video capture against the
running stack, on four typed, synthetic support-call sentences. Nothing in it is scripted
or staged: every controller decision, retrieval, claim and verifier verdict on screen is
the engine's own on that input, and no eval-stream text is typed. It sits in the
"Recording" section of the front page, muted and looping, with controls. Re-record after
a visible UI change; the poster is the final frame of the same session.

**Type.** The display serif is Instrument Serif (regular + italic), self-hosted via
`@fontsource/instrument-serif` like the Plex faces — still no runtime CDN. It is used for
headlines and pull lines only; body copy stays in IBM Plex Sans, labels in Plex Mono.

**Tests.** `src/landing/Landing.test.tsx` covers the headline and console links, the
paper/obsidian flip and its storage guard, every pillar rendering, and the engineering
tabs switching their panel; `src/route.test.ts` covers the path split.
