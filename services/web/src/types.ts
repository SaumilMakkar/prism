// Hand-written from schemas/events.schema.json, schemas/output_record.schema.json,
// and the gateway routes in services/gateway/app/main.py — do not invent fields
// that aren't actually emitted by the backend (frontend_prompt.md item 3).

export type Decision = "wait" | "retrieve" | "no_retrieval";
export type ClaimStatus = "verified" | "uncertainty";
export type AiSource = "live" | "record" | "offline" | "replay";

export interface Claim {
  claim_id: string;
  text: string;
  citation_id: string | null;
  quote: string | null;
  status: ClaimStatus;
  reason_code: string | null;
  version: number;
  sub_intent: string | null;
}

export interface ClaimDiff {
  added: string[];
  superseded: string[];
  unchanged: string[];
}

/** One hit from this turn's retrieval set — prism_core.schemas.RetrievalHit
 * plus its citation_id, exactly as the gateway's /turn response serialises
 * it. Every provenance field is what vector-service measured; null means
 * "not applicable" (e.g. no dense rank for a BM25-only hit). */
export interface EvidenceHit {
  citation_id: string;
  doc_id: string;
  section: string;
  text: string;
  score: number;
  source: string;
  doc_title: string | null;
  heading: string | null;
  version: number | null;
  effective_date: string | null;
  bm25_rank: number | null;
  dense_rank: number | null;
  rrf_score: number | null;
  rerank_rank: number | null;
  sub_query: string | null;
  cache_hit: boolean;
}

export interface TurnResponse {
  trace_id: string;
  decision: Decision;
  reason_code: string;
  claims: Claim[];
  diff: ClaimDiff;
  evidence?: EvidenceHit[];
}

/** The features the controller evaluated on one chunk, as recorded on the
 * controller_decision event (prism_core.controller.ChunkFeatures). */
export interface ChunkFeatures {
  content_tokens: number;
  entities: string[];
  clause_boundary: boolean;
  embedding_drift: number;
  is_presentation_turn: boolean;
}

export interface TelemetryEvent {
  event: string;
  trace_id: string;
  session_id_hash: string | null;
  ts: string;
  event_id?: string;
  prev_hash?: string;
  hash?: string;
  decision?: Decision;
  reason_code?: string;
  chunk_index?: number;
  features?: ChunkFeatures | null;
  doc_ids?: string[];
  hybrid_flag?: boolean;
  cache_hit?: boolean;
  cache_similarity?: number | null;
  latency_ms?: number;
  sub_queries?: string[];
  sub_query?: string;
  source?: AiSource;
  claim_id?: string;
  claim_ids?: string[];
  citation_id?: string | null;
  status?: ClaimStatus;
  added?: string[];
  superseded?: string[];
  unchanged?: string[];
}

export interface HealthResponse {
  status: string;
  ai_mode?: string;
  ml_backend?: string;
  session_ttl_seconds?: number;
}

export interface SessionStartResponse {
  session_id: string;
  token: string;
  session_ttl_seconds?: number;
}

export interface CostResponse {
  session_id: string;
  cumulative_usd: number;
}

export interface DemoStream {
  chunks: string[];
  expected_safe_chunk_index?: number | null;
  [key: string]: unknown;
}

// Verifier trail, derived client-side from the real, finite reason_code enum
// (services/gateway/app/verifier/verifier.py) — never fabricated data, just
// an honest decoding of a code the backend already produced.
export interface VerifierTrail {
  inSet: boolean;
  quoteFound: boolean;
  entailed: boolean;
}

export function verifierTrailFor(claim: Claim): VerifierTrail {
  switch (claim.reason_code) {
    case "QUOTE_MATCH_AND_ENTAILED":
      return { inSet: true, quoteFound: true, entailed: true };
    case "NOT_ENTAILED":
      return { inSet: true, quoteFound: true, entailed: false };
    case "QUOTE_MISMATCH":
      return { inSet: true, quoteFound: false, entailed: false };
    case "ID_NOT_IN_RETRIEVAL_SET":
    default:
      return { inSet: false, quoteFound: false, entailed: false };
  }
}

// Plain-sentence formatter for controller reason codes — the strings
// themselves come from prism_core/controller.py's fixed enum; the UI only
// formats them (frontend_prompt.md's decision-strip acceptance criterion).
const REASON_SENTENCES: Record<string, string> = {
  CONTENT_TOKENS_BELOW_MIN: "Waiting: not enough words yet to anchor a query.",
  NO_CLAUSE_BOUNDARY: "Waiting: the clause hasn't ended yet.",
  NO_STABLE_ENTITY: "Waiting: no named entity or content anchor found yet.",
  ENTITY_STABLE_CLAUSE_END: "Fired: an anchor appeared and the clause ended.",
  DRIFT_ABOVE_THRESHOLD_REANCHOR: "Fired: topic shifted mid-utterance — cancelled the old query and re-anchored.",
  PRESENTATION_TURN: "No retrieval: this is a re-render request (e.g. \"say that again, shorter\").",
};

export function reasonSentence(reasonCode: string): string {
  return REASON_SENTENCES[reasonCode] ?? reasonCode;
}

/** One line describing what the controller saw on a chunk, from the
 * features it actually recorded — used by the ruler tooltip and the lamp. */
export function featureSummary(features: ChunkFeatures | null | undefined): string {
  if (!features) return "features not recorded";
  const parts = [
    features.entities.length > 0 ? `anchors: ${features.entities.join(", ")}` : "no anchor",
    `drift ${features.embedding_drift.toFixed(2)}`,
    features.clause_boundary ? "clause end" : "clause open",
    `${features.content_tokens} content token${features.content_tokens === 1 ? "" : "s"}`,
  ];
  if (features.is_presentation_turn) parts.push("presentation turn");
  return parts.join(" · ");
}

// citation_id is always "Doc_ID §Section" (schemas/output_record.schema.json's
// pattern "^.+ §.+$", produced by RetrievalHit.citation_id in prism_core).
export interface ParsedCitation {
  docId: string;
  section: string;
}

export function parseCitation(citationId: string): ParsedCitation | null {
  const match = /^(.+) §(.+)$/.exec(citationId);
  if (!match) return null;
  return { docId: match[1], section: match[2] };
}
