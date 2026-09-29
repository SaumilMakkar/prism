import { TurnResponse } from "../types";

const WORDS: Record<string, string> = {
  wait: "Wait",
  retrieve: "Retrieve",
  no_retrieval: "No-Retrieval",
};

export function ControllerLamp({ turn }: { turn: TurnResponse | null }) {
  if (!turn) {
    return (
      <div className="lamp-block lamp-empty">
        <span className="lamp-word">No session yet</span>
      </div>
    );
  }
  return (
    <div className={`lamp-block lamp-${turn.decision}`} key={turn.trace_id}>
      <span className="lamp-word">{WORDS[turn.decision] ?? turn.decision}</span>
      <span className="reason-code">{turn.reason_code}</span>
    </div>
  );
}
