import { useCallback, useReducer, useRef } from "react";
import * as api from "./api";
import { Claim, Decision, EvidenceHit, HealthResponse, TelemetryEvent, TurnResponse } from "./types";

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
  // The offline-labelled safe point, when known. It only exists for the
  // committed eval streams (the guided tour reads it from the stream file
  // the gateway serves); live mic input has none, and the ruler says so.
  safeChunkIndex: number | null;
}

export type Connection = "unknown" | "ok" | "down";

export interface State {
  token: string | null;
  sessionId: string | null;
  sessionStartedAt: number | null; // epoch ms — drives the TTL countdown
  sessionTtlSeconds: number | null;
  expired: boolean;
  chunkIndex: number;
  utteranceStartedAt: number | null;
  utterances: UtteranceRecord[]; // completed utterances (history rail)
  current: UtteranceRecord | null; // the live one
  lastTurn: TurnResponse | null;
  claims: Claim[];
  // Most recent hit per citation id, accumulated across the session's turns
  // so a claim that survived from v1 still opens its evidence in v3.
  evidence: Record<string, EvidenceHit>;
  telemetry: TelemetryEvent[];
  health: HealthResponse | null;
  connection: Connection;
  cost: number;
  error: string | null;
}

export type Action =
  | { type: "SESSION_STARTED"; token: string; sessionId: string; ttlSeconds: number | null }
  | { type: "SESSION_EXPIRED" }
  | { type: "TURN_RECEIVED"; text: string; turn: TurnResponse; chunkIndex: number }
  | { type: "TELEMETRY_RECEIVED"; events: TelemetryEvent[] }
  | { type: "HEALTH_RECEIVED"; health: HealthResponse }
  | { type: "HEALTH_FAILED" }
  | { type: "COST_RECEIVED"; cost: number }
  | { type: "NEW_UTTERANCE"; safeChunkIndex?: number | null }
  | { type: "ERROR"; message: string };

export const initialState: State = {
  token: null,
  sessionId: null,
  sessionStartedAt: null,
  sessionTtlSeconds: null,
  expired: false,
  chunkIndex: 0,
  utteranceStartedAt: null,
  utterances: [],
  current: null,
  lastTurn: null,
  claims: [],
  evidence: {},
  telemetry: [],
  health: null,
  connection: "unknown",
  cost: 0,
  error: null,
};

export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SESSION_STARTED":
      return {
        ...state,
        token: action.token,
        sessionId: action.sessionId,
        sessionStartedAt: Date.now(),
        sessionTtlSeconds: action.ttlSeconds,
        expired: false,
        error: null,
      };

    case "SESSION_EXPIRED":
      // T6: nothing survives expiry — the dashboard drops everything it
      // held for the session too, keeping only service health.
      return { ...initialState, health: state.health, connection: state.connection, expired: true };

    case "NEW_UTTERANCE": {
      const utterances = state.current ? [...state.utterances, state.current] : state.utterances;
      return {
        ...state,
        utterances,
        current: {
          id: crypto.randomUUID(),
          chunks: [],
          firedChunkIndex: null,
          safeChunkIndex: action.safeChunkIndex ?? null,
        },
        utteranceStartedAt: performance.now(),
      };
    }

    case "TURN_RECEIVED": {
      const startedAt = state.utteranceStartedAt ?? performance.now();
      const current: UtteranceRecord = state.current ?? {
        id: crypto.randomUUID(),
        chunks: [],
        firedChunkIndex: null,
        safeChunkIndex: null,
      };
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

      const evidence = { ...state.evidence };
      for (const hit of action.turn.evidence ?? []) {
        evidence[hit.citation_id] = hit;
      }

      return {
        ...state,
        chunkIndex: action.chunkIndex + 1,
        utteranceStartedAt: startedAt,
        current: { ...current, chunks, firedChunkIndex },
        lastTurn: action.turn,
        claims: action.turn.claims,
        evidence,
        error: null,
      };
    }

    case "TELEMETRY_RECEIVED":
      return { ...state, telemetry: action.events };

    case "HEALTH_RECEIVED":
      return { ...state, health: action.health, connection: "ok" };

    case "HEALTH_FAILED":
      return { ...state, connection: "down" };

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
    const { token, session_id, session_ttl_seconds } = await api.startSession();
    tokenRef.current = token;
    nextChunkIndexRef.current = 0;
    dispatch({ type: "SESSION_STARTED", token, sessionId: session_id, ttlSeconds: session_ttl_seconds ?? null });
    dispatch({ type: "NEW_UTTERANCE" });
    return token;
  }, []);

  const expireSession = useCallback(() => {
    tokenRef.current = null;
    nextChunkIndexRef.current = 0;
    dispatch({ type: "SESSION_EXPIRED" });
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

  const startNewUtterance = useCallback((safeChunkIndex: number | null = null) => {
    nextChunkIndexRef.current = 0;
    dispatch({ type: "NEW_UTTERANCE", safeChunkIndex });
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
      dispatch({ type: "HEALTH_FAILED" });
    }
  }, []);

  return { state, send, startNewUtterance, loadHealth, ensureSession, expireSession };
}
