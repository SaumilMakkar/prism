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

  it("splits at punctuation and connectives and caps chunk length", () => {
    const chunks = chunkUtterance(
      "please record my message and can you make it shorter actually yesterday my tablet stopped charging after the update dot"
    );
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    for (const c of chunks) expect(c.split(" ").length).toBeLessThanOrEqual(6);
    expect(chunks.join(" ")).toBe(
      "please record my message and can you make it shorter actually yesterday my tablet stopped charging after the update."
    );
    expect(chunks[chunks.length - 1].endsWith(".")).toBe(true);
  });

  it("does not strand a single trailing word", () => {
    const chunks = chunkUtterance("my tablet screen flickers every morning, and it is loud too");
    expect(chunks.every((c) => c.split(" ").length >= 2)).toBe(true);
  });
});
