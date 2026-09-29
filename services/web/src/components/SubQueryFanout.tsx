import { Claim, TelemetryEvent } from "../types";

interface SubQueryRow {
  text: string;
  docIds: string[];
  latencyMs: number | null;
  verifiedCount: number;
  droppedCount: number;
  source: string | null;
}

function rowsFor(events: TelemetryEvent[], traceId: string, claims: Claim[]): SubQueryRow[] {
  const traceEvents = events.filter((e) => e.trace_id === traceId);
  const decompose = traceEvents.find((e) => e.event === "decompose_completed");
  const subQueries = decompose?.sub_queries ?? [];

  return subQueries.map((sq) => {
    const retrieval = traceEvents.find((e) => e.event === "retrieval_completed" && e.sub_query === sq);
    const synthesis = traceEvents.find((e) => e.event === "synthesis_completed" && e.sub_query === sq);
    const claimIds = new Set(synthesis?.claim_ids ?? []);
    const rowClaims = claims.filter((c) => claimIds.has(c.claim_id));
    return {
      text: sq,
      docIds: retrieval?.doc_ids ?? [],
      latencyMs: (retrieval?.latency_ms ?? 0) + (synthesis?.latency_ms ?? 0) || null,
      verifiedCount: rowClaims.filter((c) => c.status === "verified").length,
      droppedCount: rowClaims.filter((c) => c.status === "uncertainty").length,
      source: synthesis?.source ?? null,
    };
  });
}

/** One utterance at top, connecting edges fanning down to each sub-query —
 * a compact list with real SVG connectors, not a force graph
 * (frontend_prompt.md explicitly rules that out here). */
export function SubQueryFanout({
  utteranceText,
  events,
  traceId,
  claims,
}: {
  utteranceText: string;
  events: TelemetryEvent[];
  traceId: string | null;
  claims: Claim[];
}) {
  if (!traceId) {
    return <div className="fanout-empty">No decomposition yet.</div>;
  }
  const rows = rowsFor(events, traceId, claims);
  if (rows.length === 0) {
    return <div className="fanout-empty">No sub-queries for this turn (single-intent or no retrieval).</div>;
  }

  const rowHeight = 40;
  const svgHeight = rows.length * rowHeight + 12;

  return (
    <div className="fanout">
      <div className="fanout-root" title={utteranceText}>
        {utteranceText.length > 60 ? utteranceText.slice(0, 60) + "…" : utteranceText}
      </div>
      <div className="fanout-body">
        <svg className="fanout-edges" width={24} height={svgHeight} aria-hidden="true">
          {rows.map((_, i) => {
            const y = i * rowHeight + rowHeight / 2 + 6;
            return <path key={i} d={`M 0 0 C 12 0, 12 ${y}, 24 ${y}`} stroke="var(--rule)" fill="none" />;
          })}
        </svg>
        <ul className="fanout-list">
          {rows.map((row, i) => (
            <li key={i} className="fanout-row">
              <span className="fanout-text">{row.text}</span>
              <span className="fanout-meta">
                <span className="fanout-status">done</span>
                <span>k={row.docIds.length}</span>
                {row.latencyMs !== null && <span>{Math.round(row.latencyMs)} ms</span>}
                {row.source && <span className="badge-source">{row.source}</span>}
                {row.verifiedCount > 0 && <span className="fanout-ok">{row.verifiedCount} verified</span>}
                {row.droppedCount > 0 && <span className="fanout-dropped">{row.droppedCount} dropped</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
