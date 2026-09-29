import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceGraph, buildGraph } from "./EvidenceGraph";
import type { Claim, ClaimDiff, EvidenceHit } from "../types";

function claim(overrides: Partial<Claim>): Claim {
  return {
    claim_id: "c1",
    text: "claim text",
    citation_id: "DOC_A §1.1",
    quote: "q",
    status: "verified",
    reason_code: "QUOTE_MATCH_AND_ENTAILED",
    version: 1,
    sub_intent: null,
    ...overrides,
  };
}

function hit(overrides: Partial<EvidenceHit>): EvidenceHit {
  return {
    citation_id: "DOC_A §1.1",
    doc_id: "DOC_A",
    section: "1.1",
    text: "chunk text",
    score: 1,
    source: "fused",
    doc_title: "Document A",
    heading: "Heading",
    version: 1,
    effective_date: "2026-01-01",
    bm25_rank: 1,
    dense_rank: 2,
    rrf_score: 0.03,
    rerank_rank: 1,
    sub_query: "sq",
    cache_hit: false,
    ...overrides,
  };
}

describe("buildGraph", () => {
  it("links a verified claim to its chunk and the chunk to its document", () => {
    const g = buildGraph([claim({})], { "DOC_A §1.1": hit({}) }, undefined);
    expect(g.docs.map((n) => n.label)).toEqual(["DOC_A"]);
    expect(g.chunks.map((n) => n.label)).toEqual(["§1.1"]);
    expect(g.claims).toHaveLength(1);
    expect(g.edges).toEqual([
      { from: "claim:c1", to: "chunk:DOC_A §1.1", state: "live" },
      { from: "chunk:DOC_A §1.1", to: "doc:DOC_A", state: "live" },
    ]);
  });

  it("greys the edges of a superseded claim and of a chunk only it cites", () => {
    const diff: ClaimDiff = { added: [], superseded: ["c1"], unchanged: [] };
    const g = buildGraph([claim({})], { "DOC_A §1.1": hit({}) }, diff);
    expect(g.edges.every((e) => e.state === "superseded")).toBe(true);
    expect(g.chunks[0].state).toBe("superseded");
  });

  it("keeps a shared chunk live when another live claim still cites it", () => {
    const diff: ClaimDiff = { added: ["c2"], superseded: ["c1"], unchanged: [] };
    const g = buildGraph([claim({}), claim({ claim_id: "c2" })], { "DOC_A §1.1": hit({}) }, diff);
    expect(g.chunks[0].state).toBe("live");
    expect(g.edges.find((e) => e.from === "chunk:DOC_A §1.1")!.state).toBe("live");
  });

  it("shows a dropped claim citing an id outside the retrieval set with a dashed edge and no chunk text", () => {
    const dropped = claim({
      claim_id: "c9",
      citation_id: "DOC_X §9",
      status: "uncertainty",
      reason_code: "ID_NOT_IN_RETRIEVAL_SET",
    });
    const g = buildGraph([dropped], {}, undefined);
    expect(g.claims[0].state).toBe("dropped");
    expect(g.chunks[0]).toMatchObject({ label: "§9", sublabel: "not retrieved", state: "dropped" });
    expect(g.edges.map((e) => e.state)).toEqual(["dropped", "dropped"]);
  });

  it("dedupes documents cited by several chunks", () => {
    const hits = { "DOC_A §1.1": hit({}), "DOC_A §1.2": hit({ citation_id: "DOC_A §1.2", section: "1.2" }) };
    const g = buildGraph([claim({}), claim({ claim_id: "c2", citation_id: "DOC_A §1.2" })], hits, undefined);
    expect(g.docs).toHaveLength(1);
    expect(g.chunks).toHaveLength(2);
  });
});

describe("EvidenceGraph rendering", () => {
  it("renders one node per document, chunk and claim", () => {
    const { container } = render(
      <EvidenceGraph claims={[claim({})]} evidence={{ "DOC_A §1.1": hit({}) }} diff={undefined} />
    );
    expect(container.querySelectorAll(".graph-node")).toHaveLength(3);
    expect(container.querySelectorAll(".graph-edge")).toHaveLength(2);
  });
});
