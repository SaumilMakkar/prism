import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EvidenceDrawer, highlightQuote } from "./EvidenceDrawer";
import type { Claim, EvidenceHit } from "../types";

const claim: Claim = {
  claim_id: "c1",
  text: "the device needs the original charger",
  citation_id: "DOC_A §2.1",
  quote: "use the original charger",
  status: "verified",
  reason_code: "QUOTE_MATCH_AND_ENTAILED",
  version: 1,
  sub_intent: null,
};

const hit: EvidenceHit = {
  citation_id: "DOC_A §2.1",
  doc_id: "DOC_A",
  section: "2.1",
  text: "If the device does not start, use the original charger and wait.",
  score: 0.03,
  source: "fused",
  doc_title: "Device troubleshooting",
  heading: "Will not start",
  version: 2,
  effective_date: "2026-03-01",
  bm25_rank: 1,
  dense_rank: 3,
  rrf_score: 0.0323,
  rerank_rank: 1,
  sub_query: "device will not start",
  cache_hit: true,
};

describe("highlightQuote", () => {
  it("splits the chunk around a verbatim quote", () => {
    expect(highlightQuote("abc quote xyz", "quote")).toEqual({ before: "abc ", match: "quote", after: " xyz" });
  });

  it("returns null when the quote is not a substring", () => {
    expect(highlightQuote("abc", "zzz")).toBeNull();
    expect(highlightQuote("abc", null)).toBeNull();
  });
});

describe("EvidenceDrawer", () => {
  it("shows the full chunk with the quote marked and the real provenance", () => {
    render(<EvidenceDrawer claim={claim} hit={hit} superseded={false} onClose={vi.fn()} />);
    expect(screen.getByText("Device troubleshooting")).toBeInTheDocument();
    expect(screen.getByText("use the original charger").tagName).toBe("MARK");
    expect(screen.getByText("device will not start")).toBeInTheDocument();
    expect(screen.getByText("0.0323")).toBeInTheDocument();
    expect(screen.getByText("served from session cache")).toBeInTheDocument();
    expect(screen.getByText("version 2")).toBeInTheDocument();
  });

  it("says plainly when a citation was never retrieved instead of inventing a chunk", () => {
    const injected: Claim = { ...claim, citation_id: "DOC_Z §1", reason_code: "ID_NOT_IN_RETRIEVAL_SET", status: "uncertainty" };
    render(<EvidenceDrawer claim={injected} hit={undefined} superseded={false} onClose={vi.fn()} />);
    expect(screen.getByText(/not in any retrieval set this session/)).toBeInTheDocument();
    expect(screen.queryByText("Retrieval provenance")).not.toBeInTheDocument();
  });

  it("flags a superseded claim", () => {
    render(<EvidenceDrawer claim={claim} hit={hit} superseded={true} onClose={vi.fn()} />);
    expect(screen.getByText("superseded in this answer")).toBeInTheDocument();
  });
});
