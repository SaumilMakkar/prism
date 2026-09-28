import { describe, expect, it } from "vitest";
import { parseCitation, reasonSentence, verifierTrailFor } from "./types";
import type { Claim } from "./types";

describe("parseCitation", () => {
  it("splits a well-formed citation id into doc and section", () => {
    expect(parseCitation("KB_012 §2.1")).toEqual({ docId: "KB_012", section: "2.1" });
  });

  it("returns null for a malformed id with no section marker", () => {
    expect(parseCitation("not a citation")).toBeNull();
  });
});

function fakeClaim(overrides: Partial<Claim>): Claim {
  return {
    claim_id: "c1",
    text: "text",
    citation_id: "KB_012 §2.1",
    quote: "quote",
    status: "verified",
    reason_code: "QUOTE_MATCH_AND_ENTAILED",
    version: 1,
    sub_intent: null,
    ...overrides,
  };
}

describe("verifierTrailFor", () => {
  it("marks all three steps true for a fully verified claim", () => {
    expect(verifierTrailFor(fakeClaim({}))).toEqual({ inSet: true, quoteFound: true, entailed: true });
  });

  it("marks only the id step true when the citation isn't in the retrieval set", () => {
    expect(verifierTrailFor(fakeClaim({ reason_code: "ID_NOT_IN_RETRIEVAL_SET" }))).toEqual({
      inSet: false,
      quoteFound: false,
      entailed: false,
    });
  });

  it("marks id+quote true but entailment false when NLI rejects the claim", () => {
    expect(verifierTrailFor(fakeClaim({ reason_code: "NOT_ENTAILED" }))).toEqual({
      inSet: true,
      quoteFound: true,
      entailed: false,
    });
  });

  it("marks only id true when the quote doesn't match", () => {
    expect(verifierTrailFor(fakeClaim({ reason_code: "QUOTE_MISMATCH" }))).toEqual({
      inSet: true,
      quoteFound: false,
      entailed: false,
    });
  });
});

describe("reasonSentence", () => {
  it("formats a known controller reason code as a plain sentence", () => {
    expect(reasonSentence("ENTITY_STABLE_CLAUSE_END")).toMatch(/fired/i);
  });

  it("falls back to the raw code for an unknown reason", () => {
    expect(reasonSentence("SOME_FUTURE_CODE")).toBe("SOME_FUTURE_CODE");
  });
});
