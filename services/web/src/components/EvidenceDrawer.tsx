import { useEffect } from "react";
import { Claim, parseCitation, verifierTrailFor } from "../types";

/** Opens from a citation chip. Shows what the gateway actually returns for
 * a claim today: citation id (split into doc/section), the verbatim quote,
 * and the verifier trail. Full chunk text and retrieval provenance
 * (BM25/dense rank, RRF/rerank score) are not in the current claim/
 * telemetry payload — see the gateway TODO list rather than fabricating
 * them here. */
export function EvidenceDrawer({ claim, onClose }: { claim: Claim; onClose: () => void }) {
  const trail = verifierTrailFor(claim);
  const parsed = claim.citation_id ? parseCitation(claim.citation_id) : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="drawer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="drawer"
        role="dialog"
        aria-label="Evidence"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          Esc
        </button>
        {parsed ? (
          <div className="drawer-citation">
            {parsed.docId} <span className="drawer-section">§{parsed.section}</span>
          </div>
        ) : (
          <div className="drawer-citation drawer-citation-missing">no citation</div>
        )}
        <div className="drawer-status">
          status: {claim.status} &mdash; {claim.reason_code}
        </div>
        {claim.quote ? (
          <p className="drawer-quote">
            <mark>{claim.quote}</mark>
          </p>
        ) : (
          <p className="drawer-quote drawer-quote-missing">No quote recorded for this claim.</p>
        )}
        <div className="drawer-trail">
          <div>in retrieval set: {trail.inSet ? "yes" : "no"}</div>
          <div>quote found in chunk: {trail.quoteFound ? "yes" : "no"}</div>
          <div>entailed by chunk (NLI): {trail.entailed ? "yes" : "no"}</div>
        </div>
      </div>
    </div>
  );
}
