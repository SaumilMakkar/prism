import { TelemetryEvent, TurnResponse, reasonSentence } from "../types";

const WORDS: Record<string, string> = {
  wait: "Wait",
  retrieve: "Retrieve",
  no_retrieval: "No-Retrieval",
};

/** Large state word readable from across the room, the reason code, and
 * the features the policy actually evaluated on the latest chunk (from the
 * controller_decision event — never re-derived in the browser). */
export function ControllerLamp({ turn, events }: { turn: TurnResponse | null; events: TelemetryEvent[] }) {
  if (!turn) {
    return (
      <div className="lamp-block lamp-empty">
        <span className="lamp-word">No session yet</span>
        <span className="lamp-hint">Start the tour or take the mic.</span>
      </div>
    );
  }
  const decisionEvent = events.find((e) => e.event === "controller_decision" && e.trace_id === turn.trace_id);
  const f = decisionEvent?.features;

  return (
    <div className={`lamp-block lamp-${turn.decision}`} key={turn.trace_id}>
      <span className="lamp-word">{WORDS[turn.decision] ?? turn.decision}</span>
      <span className="reason-code">{turn.reason_code}</span>
      <span className="lamp-sentence">{reasonSentence(turn.reason_code)}</span>
      {f && (
        <dl className="lamp-features" aria-label="Features evaluated on the latest chunk">
          <div>
            <dt>anchors</dt>
            <dd>{f.entities.length > 0 ? f.entities.join(", ") : "none"}</dd>
          </div>
          <div>
            <dt>drift</dt>
            <dd>{f.embedding_drift.toFixed(2)}</dd>
          </div>
          <div>
            <dt>clause</dt>
            <dd>{f.clause_boundary ? "ended" : "open"}</dd>
          </div>
          <div>
            <dt>tokens</dt>
            <dd>{f.content_tokens}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
