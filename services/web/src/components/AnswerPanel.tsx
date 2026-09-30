import { useState } from "react";
import { AnimatePresence, appear, motion } from "../motion";
import { Claim, ClaimDiff, verifierTrailFor } from "../types";

export function claimClass(claim: Claim, diff: ClaimDiff | undefined): "added" | "superseded" | "unchanged" {
  if (!diff) return "unchanged";
  if (diff.superseded.includes(claim.claim_id)) return "superseded";
  if (diff.added.includes(claim.claim_id)) return "added";
  return "unchanged";
}

function Trail({ claim }: { claim: Claim }) {
  const t = verifierTrailFor(claim);
  const mark = (ok: boolean) => (ok ? "✔" : "✘");
  return (
    <span className="verifier-trail" title={claim.reason_code ?? undefined}>
      <span className={t.inSet ? "trail-ok" : "trail-fail"}>in set {mark(t.inSet)}</span>
      <span className={t.quoteFound ? "trail-ok" : "trail-fail"}>quote {mark(t.quoteFound)}</span>
      <span className={t.entailed ? "trail-ok" : "trail-fail"}>NLI {mark(t.entailed)}</span>
    </span>
  );
}

function ClaimRow({
  claim,
  diff,
  onOpenCitation,
}: {
  claim: Claim;
  diff: ClaimDiff | undefined;
  onOpenCitation: (claim: Claim) => void;
}) {
  const cls = claimClass(claim, diff);
  const sign = cls === "added" ? "+" : cls === "superseded" ? "−" : "=";
  return (
    <motion.div layout="position" className={`claim-row claim-${cls}`} {...appear}>
      <div className="claim-line">
        <span className="claim-sign">{sign}</span>
        <span className="claim-text">{claim.text}</span>
      </div>
      <div className="claim-sub">
        {claim.citation_id && (
          <button className="citation-chip" onClick={() => onOpenCitation(claim)}>
            [{claim.citation_id}]
          </button>
        )}
        <Trail claim={claim} />
      </div>
      {claim.quote && <div className="claim-quote">&ldquo;{claim.quote}&rdquo;</div>}
    </motion.div>
  );
}

export function AnswerPanel({
  claims,
  diff,
  version,
  costSummary,
  waitingNote,
  onOpenCitation,
}: {
  claims: Claim[];
  diff: ClaimDiff | undefined;
  version: number;
  costSummary: string;
  waitingNote?: string | null;
  onOpenCitation: (claim: Claim) => void;
}) {
  const [showDiff, setShowDiff] = useState(true);
  const [prose, setProse] = useState(false);
  const [showDropped, setShowDropped] = useState(false);

  const verified = claims.filter((c) => c.status === "verified");
  const uncertain = claims.filter((c) => c.status === "uncertainty");
  // Two different failure modes, not one: a claim the verifier actually
  // rejected (it was proposed with a citation/quote that didn't hold up)
  // vs. a sub-question synthesis never found evidence for at all. Calling
  // the second one "dropped by the verifier" would be inaccurate — it
  // never reached the verifier — and the two need separate framing so an
  // old unrelated claim never reads as an answer to a new question.
  const noEvidence = uncertain.filter((c) => c.reason_code === "NO_EVIDENCE_FOR_SUBQUERY");
  const droppedByVerifier = uncertain.filter((c) => c.reason_code !== "NO_EVIDENCE_FOR_SUBQUERY");

  const visibleVerified = showDiff
    ? verified
    : verified.filter((c) => !diff?.superseded.includes(c.claim_id));

  return (
    <section className="answer-panel" aria-live="polite">
      <div className="answer-header">
        <span className="version-tab">v{version}</span>
        <label className="toggle">
          <input type="checkbox" checked={showDiff} onChange={(e) => setShowDiff(e.target.checked)} />
          diff from previous
        </label>
        <label className="toggle">
          <input type="checkbox" checked={prose} onChange={(e) => setProse(e.target.checked)} />
          prose view
        </label>
      </div>
      <div className="answer-cost-note">{costSummary}</div>

      {visibleVerified.length === 0 && uncertain.length === 0 && (
        <div className="answer-empty">
          {waitingNote ? (
            <>
              <strong>Controller is waiting.</strong> {waitingNote} Retrieval fires once a clause ends with a
              content anchor (a device, a policy, a symptom).
            </>
          ) : (
            "No claims yet. Start the tour or take the mic; verified claims appear here with their citations."
          )}
        </div>
      )}

      {prose ? (
        <p className="answer-prose">
          {visibleVerified.map((c) => (
            <span key={c.claim_id}>
              {c.text}{" "}
              {c.citation_id && <span className="citation-chip-inline">[{c.citation_id}]</span>}{" "}
            </span>
          ))}
        </p>
      ) : (
        <div className="claim-list">
          <AnimatePresence initial={false}>
            {visibleVerified.map((c) => (
              <ClaimRow key={c.claim_id} claim={c} diff={diff} onOpenCitation={onOpenCitation} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {noEvidence.length > 0 && (
        <motion.div className="uncertainty-block" {...appear}>
          <div className="uncertainty-title">Not in the corpus</div>
          {noEvidence.map((c) => (
            <div key={c.claim_id} className="uncertainty-row">
              {c.sub_intent ?? c.text}
              <div className="uncertainty-ask">&rarr; asks: "Could you clarify or provide more detail?"</div>
            </div>
          ))}
        </motion.div>
      )}

      {droppedByVerifier.length > 0 && (
        <div className="dropped-section">
          <button className="dropped-toggle" onClick={() => setShowDropped((v) => !v)}>
            {droppedByVerifier.length} claim{droppedByVerifier.length === 1 ? "" : "s"} dropped by the verifier{" "}
            {showDropped ? "▾" : "▸"}
          </button>
          {showDropped && (
            <div className="dropped-list">
              {droppedByVerifier.map((c) => (
                <div key={c.claim_id} className="dropped-row">
                  <div className="claim-text">{c.text}</div>
                  <div className="dropped-reason">
                    {c.citation_id ? `[${c.citation_id}]` : "no citation"} &mdash; {c.reason_code}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
