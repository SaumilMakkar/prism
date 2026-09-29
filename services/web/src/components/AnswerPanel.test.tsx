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
});
