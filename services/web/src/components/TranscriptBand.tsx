import { ChunkRecord, UtteranceRecord } from "../store";
import { TelemetryEvent, featureSummary, reasonSentence } from "../types";

const RULER_WIDTH = 900;
const RULER_HEIGHT = 56;
const PAD = 24;

function xFor(atMs: number, maxMs: number): number {
  if (maxMs <= 0) return PAD;
  return PAD + (atMs / maxMs) * (RULER_WIDTH - PAD * 2);
}

function featuresByTrace(events: TelemetryEvent[]): Map<string, TelemetryEvent> {
  const map = new Map<string, TelemetryEvent>();
  for (const e of events) {
    if (e.event === "controller_decision") map.set(e.trace_id, e);
  }
  return map;
}

/** Headroom label: the one number the brief asks for (moment 7). Chunk
 * indices, not ms: the safe point is an offline label on the eval stream
 * (expected_safe_chunk_index), which is exactly what `make eval` scores. */
export function headroomLabel(utterance: UtteranceRecord): string {
  const fired = utterance.firedChunkIndex;
  const safe = utterance.safeChunkIndex;
  if (fired === null) return safe === null ? "" : `safe at chunk ${safe} · not fired yet`;
  if (safe === null) return `fired at chunk ${fired} · headroom available in replay/eval`;
  const gap = fired - safe;
  const word = Math.abs(gap) === 1 ? "chunk" : "chunks";
  if (gap === 0) return `fired at chunk ${fired}, exactly at the safe point`;
  if (gap > 0) return `fired at chunk ${fired} · safe at chunk ${safe} · ${gap} ${word} of headroom`;
  return `fired at chunk ${fired}, ${-gap} ${word} before the safe point`;
}

/** Headroom ruler: one tick per chunk, ticks joined by a connecting line
 * (the score-reading-left-to-right instrument the visual brief asks for),
 * a hollow marker at the offline safe point when the stream supplies one,
 * a filled marker where the controller actually fired, and a struck
 * marker for any provisional retrieval a later re-anchor cancelled. */
function HeadroomRuler({ utterance, events }: { utterance: UtteranceRecord; events: TelemetryEvent[] }) {
  const chunks = utterance.chunks;
  if (chunks.length === 0) return null;
  const maxMs = Math.max(1, ...chunks.map((c) => c.atMs));
  const points = chunks.map((c) => xFor(c.atMs, maxMs));
  const features = featuresByTrace(events);

  const retrieveIndices = chunks
    .map((c, i) => (c.decision === "retrieve" ? i : -1))
    .filter((i) => i >= 0);
  const firstFire = retrieveIndices[0];
  const reanchorIndices = chunks
    .map((c, i) => (c.reasonCode === "DRIFT_ABOVE_THRESHOLD_REANCHOR" ? i : -1))
    .filter((i) => i >= 0);
  const safeIdx = utterance.safeChunkIndex;
  const safePos = safeIdx !== null ? chunks.findIndex((c) => c.index === safeIdx) : -1;

  const path = points.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${RULER_HEIGHT / 2}`).join(" ");
  const mid = RULER_HEIGHT / 2;

  return (
    <svg
      className="ruler"
      viewBox={`0 0 ${RULER_WIDTH} ${RULER_HEIGHT}`}
      role="img"
      aria-label="Headroom ruler: chunk arrivals, the offline safe point, and the fired retrieval point"
    >
      <path d={path} stroke="var(--rule)" strokeWidth={1} fill="none" />
      {safePos >= 0 && (
        <g className="safe-marker">
          <polygon
            points={`${points[safePos]},${mid - 7} ${points[safePos] + 7},${mid} ${points[safePos]},${mid + 7} ${points[safePos] - 7},${mid}`}
          />
          <title>offline safe point: chunk {safeIdx}</title>
        </g>
      )}
      {points.map((x, i) => {
        const isFired = i === firstFire;
        const wasReanchored = reanchorIndices.includes(i) && i !== firstFire;
        const cancelled = firstFire !== undefined && i === firstFire && reanchorIndices.some((r) => r > i);
        const decisionEvent = features.get(chunks[i].traceId);
        return (
          <g key={chunks[i].traceId} className="ruler-tick">
            <line x1={x} x2={x} y1={mid - 6} y2={mid + 6} stroke="var(--rule)" />
            {isFired && (
              <circle className={cancelled ? "fired-marker cancelled" : "fired-marker"} cx={x} cy={mid} r={5} />
            )}
            {wasReanchored && <circle className="fired-marker" cx={x} cy={mid} r={5} />}
            {cancelled && (
              <line x1={x - 6} y1={mid - 6} x2={x + 6} y2={mid + 6} stroke="var(--dropped)" strokeWidth={1.5} />
            )}
            <title>
              chunk {chunks[i].index} at {chunks[i].atMs} ms: {chunks[i].decision} — {chunks[i].reasonCode}
              {"\n"}
              {featureSummary(decisionEvent?.features)}
            </title>
          </g>
        );
      })}
      <text x={PAD} y={RULER_HEIGHT - 4} className="ruler-label">
        {headroomLabel(utterance)}
      </text>
    </svg>
  );
}

function DecisionStrip({ chunks, events }: { chunks: ChunkRecord[]; events: TelemetryEvent[] }) {
  const features = featuresByTrace(events);
  return (
    <div className="decision-strip">
      {chunks.map((c) => (
        <div key={c.traceId} className={`decision-cell decision-${c.decision}`} tabIndex={0}>
          <span className="decision-word">{c.decision.replace("_", " ")}</span>
          <span className="reason-code">{c.reasonCode}</span>
          <div className="decision-tooltip">
            <div>{reasonSentence(c.reasonCode)}</div>
            <div className="decision-tooltip-features">{featureSummary(features.get(c.traceId)?.features)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function summarize(u: UtteranceRecord): string {
  if (u.chunks.some((c) => c.decision === "no_retrieval")) return "no retrieval";
  if (u.firedChunkIndex !== null) return `fired at chunk ${u.firedChunkIndex}`;
  return "waited";
}

/** Previous utterances collapse into a short rail above the live one —
 * each with its decision summary (frontend_prompt.md, transcript band). */
function HistoryRail({ utterances }: { utterances: UtteranceRecord[] }) {
  const finished = utterances.filter((u) => u.chunks.length > 0).slice(-3);
  if (finished.length === 0) return null;
  return (
    <ol className="history-rail" aria-label="Previous utterances">
      {finished.map((u) => {
        const text = u.chunks.map((c) => c.text).join(" ");
        return (
          <li key={u.id} className="history-item" title={text}>
            <span className="history-text">{text.length > 72 ? text.slice(0, 72) + "…" : text}</span>
            <span className={`history-summary ${u.firedChunkIndex !== null ? "history-fired" : ""}`}>
              {summarize(u)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function TranscriptBand({
  utterance,
  utterances,
  draftText,
  events,
}: {
  utterance: UtteranceRecord | null;
  utterances: UtteranceRecord[];
  draftText: string;
  events: TelemetryEvent[];
}) {
  const finalized = utterance ? utterance.chunks.map((c) => c.text).join(" ") : "";
  const empty = !finalized && !draftText;

  return (
    <section className="transcript-band">
      <HistoryRail utterances={utterances} />
      <div className="transcript-text">
        {empty ? (
          <span className="transcript-empty">No session yet. Start the tour or take the mic.</span>
        ) : (
          <>
            <span className="finalized">{finalized}</span>
            {draftText && <span className="interim"> {draftText}</span>}
          </>
        )}
        <span className="caret" aria-hidden="true" />
      </div>
      {utterance && utterance.chunks.length > 0 && (
        <>
          <HeadroomRuler utterance={utterance} events={events} />
          <DecisionStrip chunks={utterance.chunks} events={events} />
        </>
      )}
    </section>
  );
}
