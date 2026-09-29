import { useEffect } from "react";
import { EASE, motion } from "../motion";
import { Claim, EvidenceHit, parseCitation, verifierTrailFor } from "../types";

/** Split a chunk around the verbatim quote so it can be <mark>ed. Returns
 * null when the quote is not a substring — which is itself information:
 * the verifier's QUOTE_MISMATCH means exactly this. */
export function highlightQuote(text: string, quote: string | null): { before: string; match: string; after: string } | null {
  if (!quote) return null;
  const idx = text.indexOf(quote);
  if (idx < 0) return null;
  return { before: text.slice(0, idx), match: quote, after: text.slice(idx + quote.length) };
}

function fmt(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return "—";
  return digits ? n.toFixed(digits) : String(n);
}

/** Opens from a citation chip. Everything shown comes from the gateway's
 * /turn payload: the claim itself, and the retrieval hit for its citation
 * (full chunk, document metadata, BM25/dense/RRF/rerank provenance, cache
 * hit). A citation with no hit this session is shown as exactly that —
 * the injected-chunk case — never filled in. */
export function EvidenceDrawer({
  claim,
  hit,
  superseded,
  onClose,
}: {
  claim: Claim;
  hit: EvidenceHit | undefined;
  superseded: boolean;
  onClose: () => void;
}) {
  const trail = verifierTrailFor(claim);
  const parsed = claim.citation_id ? parseCitation(claim.citation_id) : null;
  const highlighted = hit ? highlightQuote(hit.text, claim.quote) : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="drawer-backdrop"
      role="presentation"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <motion.div
        className="drawer"
        role="dialog"
        aria-label="Evidence"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 48, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 32, opacity: 0, transition: { duration: 0.18 } }}
        transition={{ duration: 0.32, ease: EASE }}
      >
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          Esc
        </button>

        {hit?.doc_title && <div className="drawer-title">{hit.doc_title}</div>}
        {parsed ? (
          <div className="drawer-citation">
            {parsed.docId} <span className="drawer-section">§{parsed.section}</span>
            {hit?.heading && <span className="drawer-heading"> {hit.heading}</span>}
          </div>
        ) : (
          <div className="drawer-citation drawer-citation-missing">no citation</div>
        )}
        <div className="drawer-meta">
          {hit?.version !== null && hit?.version !== undefined && <span>version {hit.version}</span>}
          {hit?.effective_date && <span>effective {hit.effective_date}</span>}
          {superseded && <span className="drawer-badge-superseded">superseded in this answer</span>}
          {hit?.cache_hit && <span className="drawer-badge-cached">served from session cache</span>}
        </div>
        <div className="drawer-status">
          status {claim.status} &mdash; <span className="reason-code">{claim.reason_code}</span>
        </div>

        {hit ? (
          <div className="drawer-chunk">
            <div className="drawer-label">Chunk as retrieved</div>
            <p className="drawer-chunk-text">
              {highlighted ? (
                <>
                  {highlighted.before}
                  <mark>{highlighted.match}</mark>
                  {highlighted.after}
                </>
              ) : (
                hit.text
              )}
            </p>
            {!highlighted && claim.quote && (
              <p className="drawer-quote-missing">
                The claim's quote is not a verbatim substring of this chunk: &ldquo;{claim.quote}&rdquo;
              </p>
            )}
          </div>
        ) : (
          <div className="drawer-chunk">
            <div className="drawer-label">Chunk as retrieved</div>
            <p className="drawer-quote-missing">
              This citation is not in any retrieval set this session, so there is no chunk to show. The verifier
              rejects such claims by construction.
            </p>
            {claim.quote && (
              <p className="drawer-quote">
                claimed quote: <mark>{claim.quote}</mark>
              </p>
            )}
          </div>
        )}

        <div className="drawer-label">Verifier trail</div>
        <div className="drawer-trail">
          <div>
            <span className={trail.inSet ? "trail-ok" : "trail-fail"}>{trail.inSet ? "✔" : "✘"}</span> in this turn's
            retrieval set
          </div>
          <div>
            <span className={trail.quoteFound ? "trail-ok" : "trail-fail"}>{trail.quoteFound ? "✔" : "✘"}</span> quote
            found verbatim in chunk
          </div>
          <div>
            <span className={trail.entailed ? "trail-ok" : "trail-fail"}>{trail.entailed ? "✔" : "✘"}</span> claim
            entailed by chunk (NLI)
          </div>
        </div>

        {hit && (
          <>
            <div className="drawer-label">Retrieval provenance</div>
            <dl className="drawer-provenance">
              <div>
                <dt>sub-query</dt>
                <dd>{hit.sub_query ?? "—"}</dd>
              </div>
              <div>
                <dt>BM25 rank</dt>
                <dd>{fmt(hit.bm25_rank)}</dd>
              </div>
              <div>
                <dt>dense rank</dt>
                <dd>{fmt(hit.dense_rank)}</dd>
              </div>
              <div>
                <dt>RRF score</dt>
                <dd>{fmt(hit.rrf_score, 4)}</dd>
              </div>
              <div>
                <dt>rerank rank</dt>
                <dd>{fmt(hit.rerank_rank)}</dd>
              </div>
              <div>
                <dt>source</dt>
                <dd>{hit.source}</dd>
              </div>
              <div>
                <dt>cache</dt>
                <dd>{hit.cache_hit ? "hit" : "miss"}</dd>
              </div>
            </dl>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
