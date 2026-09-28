import { useCallback, useReducer, useRef } from "react";
import * as api from "./api";
import { Claim, Decision, HealthResponse, TelemetryEvent, TurnResponse } from "./types";

export interface ChunkRecord {
  index: number;
  text: string;
  decision: Decision;
  reasonCode: string;
  traceId: string;
  atMs: number; // ms since the current utterance started — drives the headroom ruler
}

export interface UtteranceRecord {
  id: string;
  chunks: ChunkRecord[];
  firedChunkIndex: number | null; // first RETRIEVE in this utterance
}

export interface State {
  token: string | null;
  chunkIndex: number;
  utteranceStartedAt: number | null;
  utterances: UtteranceRecord[]; // completed utterances (history rail)
  current: UtteranceRecord | null; // the live one
  lastTurn: TurnResponse | null;
  claims: Claim[];
  telemetry: TelemetryEvent[];
  health: HealthResponse | null;
  cost: number;
  error: string | null;
}

export type Action =
  | { type: "SESSION_STARTED"; token: string }
  | { type: "TURN_RECEIVED"; text: string; turn: TurnResponse; chunkIndex: number }
  | { type: "TELEMETRY_RECEIVED"; events: TelemetryEvent[] }
  | { type: "HEALTH_RECEIVED"; health: HealthResponse }
  | { type: "COST_RECEIVED"; cost: number }
  | { type: "NEW_UTTERANCE" }
  | { type: "ERROR"; message: string };

export const initialState: State = {
  token: null,
  chunkIndex: 0,
  utteranceStartedAt: null,
  utterances: [],
  current: null,
  lastTurn: null,
  claims: [],
  telemetry: [],
  health: null,
  cost: 0,
  error: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SESSION_STARTED":
      return { ...state, token: action.token, error: null };

    case "NEW_UTTERANCE": {
      const utterances = state.current ? [...state.utterances, state.current] : state.utterances;
      return {
        ...state,
        utterances,
        current: { id: crypto.randomUUID(), chunks: [], firedChunkIndex: null },
        utteranceStartedAt: performance.now(),
      };
    }

    case "TURN_RECEIVED": {
      const startedAt = state.utteranceStartedAt ?? performance.now();
      const current: UtteranceRecord = state.current ?? { id: crypto.randomUUID(), chunks: [], firedChunkIndex: null };
      const chunk: ChunkRecord = {
        index: action.chunkIndex,
        text: action.text,
        decision: action.turn.decision,
        reasonCode: action.turn.reason_code,
        traceId: action.turn.trace_id,
        atMs: Math.round(performance.now() - startedAt),
      };
      const chunks = [...current.chunks, chunk];
      const firedChunkIndex =
        current.firedChunkIndex ?? (action.turn.decision === "retrieve" ? action.chunkIndex : null);

      return {
        ...state,
        chunkIndex: action.chunkIndex + 1,
        utteranceStartedAt: startedAt,
        current: { ...current, chunks, firedChunkIndex },
        lastTurn: action.turn,
        claims: action.turn.claims,
        error: null,
      };
    }

    case "TELEMETRY_RECEIVED":
      return { ...state, telemetry: action.events };

    case "HEALTH_RECEIVED":
      return { ...state, health: action.health };

    case "COST_RECEIVED":
      return { ...state, cost: action.cost };

    case "ERROR":
      return { ...state, error: action.message };

    default:
      return state;
  }
}

export function usePreludeSession() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const tokenRef = useRef<string | null>(null);
  // A ref, not state.chunkIndex, drives the next index `send` uses: `send`
  // is called in tight sequential loops (the guided tour), and reading
  // state.chunkIndex from a useCallback closure would capture a stale value
  // across iterations that happen between React re-renders.
  const nextChunkIndexRef = useRef(0);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (tokenRef.current) return tokenRef.current;
    const { token } = await api.startSession();
    tokenRef.current = token;
    dispatch({ type: "SESSION_STARTED", token });
    dispatch({ type: "NEW_UTTERANCE" });
    return token;
  }, []);

  const refreshTelemetry = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const { events } = await api.getTelemetry(tokenRef.current);
      dispatch({ type: "TELEMETRY_RECEIVED", events });
    } catch {
      // telemetry pane is supplementary; a failed poll shouldn't surface as a hard error
    }
  }, []);

  const refreshCost = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const { cumulative_usd } = await api.getCost(tokenRef.current);
      dispatch({ type: "COST_RECEIVED", cost: cumulative_usd });
    } catch {
      // best-effort
    }
  }, []);

  const startNewUtterance = useCallback(() => {
    nextChunkIndexRef.current = 0;
    dispatch({ type: "NEW_UTTERANCE" });
  }, []);

  const send = useCallback(
    async (text: string) => {
      try {
        const token = await ensureSession();
        const chunkIndex = nextChunkIndexRef.current++;
        const turn = await api.sendChunk(token, chunkIndex, text);
        dispatch({ type: "TURN_RECEIVED", text, turn, chunkIndex });
        await refreshTelemetry();
        await refreshCost();
        return turn;
      } catch (e) {
        dispatch({ type: "ERROR", message: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },
    [ensureSession, refreshTelemetry, refreshCost]
  );

  const loadHealth = useCallback(async () => {
    try {
      const health = await api.getHealth();
      dispatch({ type: "HEALTH_RECEIVED", health });
    } catch {
      // header badges just stay blank
    }
  }, []);

  return { state, send, startNewUtterance, loadHealth, ensureSession };
}
