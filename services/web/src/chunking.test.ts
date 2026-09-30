import { describe, expect, it } from "vitest";
import { chunkUtterance, normalizeSpokenPunctuation } from "./chunking";

describe("normalizeSpokenPunctuation", () => {
  it("turns a trailing spoken 'dot' into a period", () => {
    expect(normalizeSpokenPunctuation("my phone died dot")).toBe("my phone died.");
    expect(normalizeSpokenPunctuation("is it covered question mark")).toBe("is it covered?");
  });

  it("leaves ordinary text alone", () => {
    expect(normalizeSpokenPunctuation("the dot matrix printer")).toBe("the dot matrix printer");
  });
});

describe("chunkUtterance", () => {
  it("returns nothing for empty input", () => {
    expect(chunkUtterance("   ")).toEqual([]);
  });

  it("keeps a short utterance as one chunk", () => {
    expect(chunkUtterance("my phone will not start")).toEqual(["my phone will not start"]);
  });

  it("splits at punctuation and connectives, capping chunk length without stranding a short tail", () => {
    const chunks = chunkUtterance(
      "please record my message and can you make it shorter actually yesterday my tablet stopped charging after the update dot"
    );
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    // Every chunk stays under the cap UNLESS it absorbed a trailing
    // fragment too short to ever satisfy the controller on its own
    // ("after the update." was 3 words) — never stranding one takes
    // priority over the soft length cap.
    for (const c of chunks) {
      const words = c.split(" ").length;
      expect(words <= 6 || words >= 4).toBe(true);
    }
    expect(chunks.join(" ")).toBe(
      "please record my message and can you make it shorter actually yesterday my tablet stopped charging after the update."
    );
    expect(chunks[chunks.length - 1].endsWith(".")).toBe(true);
  });

  it("does not slice a single unpunctuated clause into two chunks the controller can never fire on", () => {
    // Real bug: a 9-word sentence with no comma or connective in its first
    // six words got cut at the hard 6-word cap into a first fragment that
    // loses the clause-ending period, and a trailing fragment too short
    // (below the controller's own 4-word minimum) to ever fire - neither
    // half could ever fire, even though the full sentence obviously should.
    const chunks = chunkUtterance("my tablet stopped responding what should I do.");
    expect(chunks).toEqual(["my tablet stopped responding what should I do."]);
  });

  it("does not strand a single trailing word", () => {
    const chunks = chunkUtterance("my tablet screen flickers every morning, and it is loud too");
    expect(chunks.every((c) => c.split(" ").length >= 2)).toBe(true);
  });

  it("treats the end of a finalized speech result as a clause boundary", () => {
    const chunks = chunkUtterance("yesterday my tablet screen went dark while charging", { endOfUtterance: true });
    expect(chunks[chunks.length - 1].endsWith(".")).toBe(true);
    expect(chunks.join(" ")).toBe("yesterday my tablet screen went dark while charging.");
  });

  it("does not double the punctuation when the speaker said it", () => {
    const chunks = chunkUtterance("is it covered question mark", { endOfUtterance: true });
    expect(chunks.join(" ")).toBe("is it covered?");
  });
});
