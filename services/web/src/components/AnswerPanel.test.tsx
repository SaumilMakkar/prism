import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnswerPanel, claimClass } from "./AnswerPanel";
import type { Claim, ClaimDiff } from "../types";

function fakeClaim(overrides: Partial<Claim>): Claim {
  return {
    claim_id: "c1",
    text: "claim text",
    citation_id: "KB_012 §2.1",
    quote: "quote",
    status: "verified",
    reason_code: "QUOTE_MATCH_AND_ENTAILED",
    version: 1,
    sub_intent: null,
    ...overrides,
  };
}

describe("claimClass (v1 -> v2 diff logic)", () => {
  const diff: ClaimDiff = { added: ["new"], superseded: ["old"], unchanged: ["same"] };

  it("marks a claim in diff.added as added", () => {
    expect(claimClass(fakeClaim({ claim_id: "new" }), diff)).toBe("added");
  });

  it("marks a claim in diff.superseded as superseded", () => {
    expect(claimClass(fakeClaim({ claim_id: "old" }), diff)).toBe("superseded");
  });

  it("marks a claim in neither list as unchanged", () => {
    expect(claimClass(fakeClaim({ claim_id: "same" }), diff)).toBe("unchanged");
  });

  it("treats every claim as unchanged when there is no diff yet", () => {
    expect(claimClass(fakeClaim({ claim_id: "whatever" }), undefined)).toBe("unchanged");
  });
});

describe("AnswerPanel rendering", () => {
  it("renders added and superseded rows with their citations preserved", () => {
    const claims = [
      fakeClaim({ claim_id: "new", text: "new claim", citation_id: "KB_012 §2.1" }),
      fakeClaim({ claim_id: "old", text: "old claim", citation_id: "POL_004 §4.1" }),
    ];
    const diff: ClaimDiff = { added: ["new"], superseded: ["old"], unchanged: [] };

    render(
      <AnswerPanel claims={claims} diff={diff} version={2} costSummary="" onOpenCitation={vi.fn()} />
    );

    expect(screen.getByText("new claim")).toBeInTheDocument();
    expect(screen.getByText("old claim")).toBeInTheDocument();
    expect(screen.getByText("[KB_012 §2.1]")).toBeInTheDocument();
    expect(screen.getByText("[POL_004 §4.1]")).toBeInTheDocument();
  });

  it("shows an old unrelated claim alongside an explicit not-in-corpus note, not silently alone", () => {
    // Real bug: a verified claim from an earlier topic (e.g. the guided
    // tour's SmartThings scenario) kept rendering with no indication it
    // didn't answer a brand-new, unrelated question ("what's the trade-in
    // value for my old phone?"). The gateway now emits an explicit
    // NO_EVIDENCE_FOR_SUBQUERY claim for the new question; this proves the
    // panel renders both, correctly separated, rather than just the stale
    // verified claim on its own.
    const claims = [
      fakeClaim({
        claim_id: "old-smartthings",
        text: "Sign in with the same Samsung account used on the phone so devices sync automatically.",
        citation_id: "KB_030 §6.1",
        status: "verified",
      }),
      fakeClaim({
        claim_id: "no-evidence",
        text: "No evidence found for: what's the trade-in value for my old phone?",
        citation_id: null,
        quote: null,
        status: "uncertainty",
        reason_code: "NO_EVIDENCE_FOR_SUBQUERY",
        sub_intent: "what's the trade-in value for my old phone?",
      }),
    ];
    const diff: ClaimDiff = { added: [], superseded: [], unchanged: ["old-smartthings", "no-evidence"] };

    render(
      <AnswerPanel claims={claims} diff={diff} version={1} costSummary="" onOpenCitation={vi.fn()} />
    );

    expect(screen.getByText(/Sign in with the same Samsung account/)).toBeInTheDocument();
    expect(screen.getByText("Not in the corpus")).toBeInTheDocument();
    expect(screen.getByText("what's the trade-in value for my old phone?")).toBeInTheDocument();
    // Must not be mislabelled as a verifier rejection - it was never proposed.
    expect(screen.queryByText(/dropped by the verifier/)).not.toBeInTheDocument();
  });
});
