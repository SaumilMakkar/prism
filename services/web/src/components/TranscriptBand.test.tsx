import { describe, expect, it } from "vitest";
import { headroomLabel } from "./TranscriptBand";
import type { UtteranceRecord } from "../store";

function utterance(fired: number | null, safe: number | null): UtteranceRecord {
  return { id: "u", chunks: [], firedChunkIndex: fired, safeChunkIndex: safe };
}

describe("headroomLabel (moment 7: one number)", () => {
  it("says headroom is only available in replay/eval when the stream has no safe label", () => {
    expect(headroomLabel(utterance(2, null))).toBe("fired at chunk 2 · headroom available in replay/eval");
  });

  it("reports the gap in chunks when the controller fired after the safe point", () => {
    expect(headroomLabel(utterance(3, 1))).toBe("fired at chunk 3 · safe at chunk 1 · 2 chunks of headroom");
  });

  it("reports an exact hit on the safe point", () => {
    expect(headroomLabel(utterance(1, 1))).toBe("fired at chunk 1, exactly at the safe point");
  });

  it("reports a premature fire honestly", () => {
    expect(headroomLabel(utterance(0, 1))).toBe("fired at chunk 0, 1 chunk before the safe point");
  });

  it("is empty until anything is known", () => {
    expect(headroomLabel(utterance(null, null))).toBe("");
  });
});
