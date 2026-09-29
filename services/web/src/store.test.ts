import { describe, expect, it } from "vitest";
import { initialState, reducer } from "./store";
import type { TurnResponse } from "./types";

function fakeTurn(overrides: Partial<TurnResponse>): TurnResponse {
  return {
    trace_id: "t1",
    decision: "wait",
    reason_code: "NO_CLAUSE_BOUNDARY",
    claims: [],
    diff: { added: [], superseded: [], unchanged: [] },
    ...overrides,
  };
}

describe("reducer", () => {
  it("starts a new utterance with no chunks", () => {
    const state = reducer(initialState, { type: "NEW_UTTERANCE" });
    expect(state.current).not.toBeNull();
    expect(state.current!.chunks).toEqual([]);
    expect(state.current!.firedChunkIndex).toBeNull();
  });

  it("records a chunk's decision and reason code on TURN_RECEIVED", () => {
    let state = reducer(initialState, { type: "NEW_UTTERANCE" });
    const turn = fakeTurn({ decision: "wait", reason_code: "CONTENT_TOKENS_BELOW_MIN" });
    state = reducer(state, { type: "TURN_RECEIVED", text: "My phone", turn, chunkIndex: 0 });

    expect(state.current!.chunks).toHaveLength(1);
    expect(state.current!.chunks[0]).toMatchObject({
      index: 0,
      text: "My phone",
      decision: "wait",
      reasonCode: "CONTENT_TOKENS_BELOW_MIN",
    });
    expect(state.chunkIndex).toBe(1);
  });

  it("sets firedChunkIndex to the first RETRIEVE chunk and keeps it on later WAITs", () => {
    let state = reducer(initialState, { type: "NEW_UTTERANCE" });
    state = reducer(state, {
      type: "TURN_RECEIVED",
      text: "chunk 0",
      turn: fakeTurn({ decision: "wait", reason_code: "NO_CLAUSE_BOUNDARY" }),
      chunkIndex: 0,
    });
    state = reducer(state, {
      type: "TURN_RECEIVED",
      text: "chunk 1",
      turn: fakeTurn({ decision: "retrieve", reason_code: "ENTITY_STABLE_CLAUSE_END" }),
      chunkIndex: 1,
    });
    expect(state.current!.firedChunkIndex).toBe(1);

    state = reducer(state, {
      type: "TURN_RECEIVED",
      text: "chunk 2",
      turn: fakeTurn({ decision: "wait", reason_code: "NO_CLAUSE_BOUNDARY" }),
      chunkIndex: 2,
    });
    // A later WAIT must not overwrite the already-recorded fire point.
    expect(state.current!.firedChunkIndex).toBe(1);
  });

  it("moves the current utterance into history on the next NEW_UTTERANCE", () => {
    let state = reducer(initialState, { type: "NEW_UTTERANCE" });
    state = reducer(state, {
      type: "TURN_RECEIVED",
      text: "chunk 0",
      turn: fakeTurn({}),
      chunkIndex: 0,
    });
    const firstUtteranceId = state.current!.id;

    state = reducer(state, { type: "NEW_UTTERANCE" });
    expect(state.utterances).toHaveLength(1);
    expect(state.utterances[0].id).toBe(firstUtteranceId);
    expect(state.current!.chunks).toEqual([]);
  });

  it("stores the latest turn's claims regardless of decision", () => {
    let state = reducer(initialState, { type: "NEW_UTTERANCE" });
    const claim = {
      claim_id: "c1",
      text: "claim text",
      citation_id: "KB_012 §2.1",
      quote: "quote",
      status: "verified" as const,
      reason_code: "QUOTE_MATCH_AND_ENTAILED",
      version: 1,
      sub_intent: null,
    };
    state = reducer(state, {
      type: "TURN_RECEIVED",
      text: "chunk 0",
      turn: fakeTurn({ decision: "retrieve", claims: [claim] }),
      chunkIndex: 0,
    });
    expect(state.claims).toEqual([claim]);
  });
});
