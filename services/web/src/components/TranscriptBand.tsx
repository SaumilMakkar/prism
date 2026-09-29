import { ChunkRecord, UtteranceRecord } from "../store";
import { reasonSentence } from "../types";

const RULER_WIDTH = 900;
const RULER_HEIGHT = 56;
const PAD = 24;

function xFor(atMs: number, maxMs: number): number {
  if (maxMs <= 0) return PAD;
  return PAD + (atMs / maxMs) * (RULER_WIDTH - PAD * 2);
}

/** Headroom ruler: one tick per chunk, ticks joined by a connecting line
 * (the score-reading-left-to-right instrument the visual brief asks for),
 * a filled marker where the controller actually fired, and a struck
 * marker for any provisional retrieval a later DRIFT_CANCEL re-anchored. */
function HeadroomRuler({ utterance }: { utterance: UtteranceRecord }) {
  const chunks = utterance.chunks;
  if (chunks.length === 0) return null;
  const maxMs = Math.max(1, ...chunks.map((c) => c.atMs));
  const points = chunks.map((c) => xFor(c.atMs, maxMs));

  const retrieveIndices = chunks
    .map((c, i) => (c.decision === "retrieve" ? i : -1))
    .filter((i) => i >= 0);
  const firstFire = retrieveIndices[0];
  const reanchorIndices = chunks
    .map((c, i) => (c.reasonCode === "DRIFT_ABOVE_THRESHOLD_REANCHOR" ? i : -1))
    .filter((i) => i >= 0);

  const path = points.map((x, i) => `${i === 0 ? "M" : "L"} ${x} ${RULER_HEIGHT / 2}`).join(" ");

  return (
    <svg
      className="ruler"
      viewBox={`0 0 ${RULER_WIDTH} ${RULER_HEIGHT}`}
      role="img"
      aria-label="Headroom ruler: chunk arrivals and the fired retrieval point"
    >
      <path d={path} stroke="var(--rule)" strokeWidth={1} fill="none" />
      {points.map((x, i) => {
        const isFired = i === firstFire;
        const wasReanchored = reanchorIndices.includes(i) && i !== firstFire;
        const cancelled = firstFire !== undefined && i === firstFire && reanchorIndices.some((r) => r > i);
        return (
          <g key={chunks[i].traceId} className="ruler-tick">
            <line x1={x} x2={x} y1={RULER_HEIGHT / 2 - 6} y2={RULER_HEIGHT / 2 + 6} stroke="var(--rule)" />
            {isFired && (
              <circle
                className={cancelled ? "fired-marker cancelled" : "fired-marker"}
                cx={x}
                cy={RULER_HEIGHT / 2}
                r={5}
              />
            )}
            {wasReanchored && <circle className="fired-marker" cx={x} cy={RULER_HEIGHT / 2} r={5} />}
            {cancelled && (
              <line
                x1={x - 6}
                y1={RULER_HEIGHT / 2 - 6}
                x2={x + 6}
                y2={RULER_HEIGHT / 2 + 6}
                stroke="var(--dropped)"
                strokeWidth={1.5}
              />
            )}
            <title>
              chunk {chunks[i].index}: {chunks[i].decision} — {chunks[i].reasonCode}
            </title>
          </g>
        );
      })}
      {firstFire !== undefined && (
        <text x={points[firstFire]} y={RULER_HEIGHT - 4} className="ruler-label" textAnchor="middle">
          fired at chunk {chunks[firstFire].index}
        </text>
      )}
    </svg>
  );
}

function DecisionStrip({ chunks }: { chunks: ChunkRecord[] }) {
  return (
    <div className="decision-strip">
      {chunks.map((c) => (
        <div key={c.traceId} className={`decision-cell decision-${c.decision}`} tabIndex={0}>
          <span className="decision-word">{c.decision.replace("_", " ")}</span>
          <span className="reason-code">{c.reasonCode}</span>
          <div className="decision-tooltip">{reasonSentence(c.reasonCode)}</div>
        </div>
      ))}
    </div>
  );
}

export function TranscriptBand({
  utterance,
  draftText,
}: {
  utterance: UtteranceRecord | null;
  draftText: string;
}) {
  const finalized = utterance ? utterance.chunks.map((c) => c.text).join(" ") : "";

  return (
    <section className="transcript-band">
      <div className="transcript-text">
        <span className="finalized">{finalized}</span>
        {draftText && <span className="interim"> {draftText}</span>}
        <span className="caret" aria-hidden="true" />
      </div>
      {utterance && utterance.chunks.length > 0 && (
        <>
          <HeadroomRuler utterance={utterance} />
          <DecisionStrip chunks={utterance.chunks} />
        </>
      )}
    </section>
  );
}
