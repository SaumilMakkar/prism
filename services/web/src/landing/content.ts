/** Copy for the front page. Everything here is a claim the repo backs:
 * numbers come from README.md's scorecard and documentation/prelude.md,
 * nothing is a marketing figure. No eval-stream text and no adversarial
 * document id may appear here (scripts/check_no_eval_hardcode.py). */

export interface Stat {
  value: string;
  label: string;
  note?: string;
}

export const STATS: Stat[] = [
  {
    value: "6 / 6",
    label: "Evaluation gates passed, G1 to G6",
    note: "Measured offline with the hash ML backend against the 7 sample streams; see evaluation/results/scorecard.md.",
  },
  {
    value: "0",
    label: "LLM calls in the controller loop",
    note: "Guarded by a unit test: the controller has no client and no model attribute.",
  },
  { value: "5", label: "Services, each boundary justified in an ADR" },
  { value: "≤ 90 s", label: "From make up to a running demo", note: "Target, with images pre-pulled." },
];

export interface Pillar {
  id: string;
  title: string;
  headline: [string, string, string]; // plain, emphasised, plain
  sub: string;
  points: string[];
  glyph: "ruler" | "seal" | "diff" | "limit";
}

export const PILLARS: Pillar[] = [
  {
    id: "earliness",
    title: "Measured earliness",
    headline: ["The ", "gap between safe and fired", ", on every utterance."],
    sub: "Every team claims early retrieval. We measure how early it was safe.",
    points: [
      "Offline label per utterance: the chunk at which provisional top-k overlaps final top-k by 60% or more",
      "Hollow marker at the safe chunk, filled marker where the controller fired, on a real millisecond axis",
      "Headroom reported in chunks; the benchmark reports the distribution across streams (G2)",
    ],
    glyph: "ruler",
  },
  {
    id: "verifiable",
    title: "Verifiable claims",
    headline: ["Every claim carries a ", "citation and a verbatim quote", "."],
    sub: "The verifier can only subtract. It never edits, invents, or promotes a claim.",
    points: [
      "The cited document id must be in this turn’s retrieval set",
      "The quote must exist in the cited chunk, then NLI entailment has to hold",
      "An injected “ignore the evidence” chunk is retrieved, cited by the model, and dropped, with telemetry showing why",
    ],
    glyph: "seal",
  },
  {
    id: "refine",
    title: "Refine, not restart",
    headline: ["A late detail ", "updates two claims", ", not the whole answer."],
    sub: "Rendered as a diff: unchanged grey, added green, superseded struck through, citations preserved.",
    points: [
      "One targeted sub-query instead of three, because the claim graph knows what is already settled",
      "A session semantic cache answers repeats without a search, and says so",
      "“Say that again, shorter” re-renders from stored claims with zero retrievals",
    ],
    glyph: "diff",
  },
  {
    id: "limits",
    title: "Known limits",
    headline: ["", "Not in the corpus", " is a designed state, not an error."],
    sub: "Teams that know their limits are trusted more than teams that only show success.",
    points: [
      "Unsupported claims move to an uncertainty block, with the question the agent should ask",
      "Give the judge the mic: unscripted, off-corpus input degrades gracefully",
      "Every decision, retrieval and verdict lands in a hash-chained log you can verify from the console",
    ],
    glyph: "limit",
  },
];

export const MARQUEE = [
  "WAIT",
  "RETRIEVE",
  "NO-RETRIEVAL",
  "CLAUSE BOUNDARY",
  "ANCHOR TOKENS",
  "DRIFT",
  "BM25",
  "DENSE",
  "RRF FUSION",
  "RERANK",
  "NLI",
  "CLAIM DIFF",
  "SEMANTIC CACHE",
  "HASH CHAIN",
  "UNCERTAINTY",
];

export interface Tab {
  id: string;
  index: string;
  label: string;
  title: string;
  lede: string;
  chips: string[];
}

export const TABS: Tab[] = [
  {
    id: "controller",
    index: "00-1",
    label: "Controller",
    title: "Rules first. No model in the loop.",
    lede:
      "A 300 ms model call on every 0.8 s chunk is the guide’s first pitfall. The controller reads anchor tokens, drift and clause boundaries instead, and every decision ships with a reason code.",
    chips: [
      "ANCHOR TOKENS",
      "DRIFT",
      "CLAUSE BOUNDARY",
      "CONTENT TOKENS",
      "WAIT / RETRIEVE / NO-RETRIEVAL",
      "REASON CODES",
      "UNIT-GUARDED: NO CLIENT, NO MODEL",
      "PURE PYTHON, NO I/O",
    ],
  },
  {
    id: "retrieval",
    index: "00-2",
    label: "Retrieval",
    title: "Hybrid, fused, reranked, in parallel.",
    lede:
      "One sub-query per intent fans out at once. BM25 and dense scores are fused by reciprocal rank, then reranked, so a late-arriving detail only re-runs the query it touches.",
    chips: [
      "BM25",
      "DENSE (BGE-SMALL)",
      "RRF FUSION",
      "MINILM RERANK",
      "SUB-QUERY FAN-OUT",
      "SESSION SEMANTIC CACHE",
      "QDRANT",
      "HASH BACKEND, KEY-FREE",
      "SECTIONED CHUNKS",
    ],
  },
  {
    id: "synthesis",
    index: "00-3",
    label: "Synthesis",
    title: "Claims, not paragraphs.",
    lede:
      "The model returns a list of claims, each with a citation and a verbatim quote, so refinement is a graph edit rather than a rewrite. Recorded trajectories make the whole demo replayable without a key.",
    chips: [
      "CLAIM GRAPH",
      "VERSIONED CLAIMS",
      "SUPERSEDED EDGES",
      "LIVE / RECORD / OFFLINE / REPLAY",
      "COMMITTED TRAJECTORIES",
      "PER-SESSION COST METER",
      "VERSIONED PROMPTS",
    ],
  },
  {
    id: "verifier",
    index: "00-4",
    label: "Verifier & telemetry",
    title: "Subtract only. Then prove it.",
    lede:
      "Citation in the retrieval set, quote in the chunk, entailment holds. Anything that fails moves to uncertainty. Every step is written to a hash-chained log with the session id hashed, verifiable from the console.",
    chips: [
      "RETRIEVAL-SET CHECK",
      "VERBATIM QUOTE MATCH",
      "NLI ENTAILMENT",
      "UNCERTAINTY BLOCK",
      "HASH-CHAINED TELEMETRY",
      "SESSION ID HASHED",
      "EXPORT JSONL",
      "MCP ADAPTER",
    ],
  },
];

export const NAV = [
  { href: "#pillars", label: "Pillars" },
  { href: "#apparatus", label: "Apparatus" },
  { href: "#engineering", label: "Engineering" },
];
