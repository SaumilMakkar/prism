import { Claim, ClaimDiff, EvidenceHit, parseCitation } from "../types";

/** Evidence graph (F13): claims ↔ chunks ↔ documents for the current
 * answer. Three layers laid out by hand in SVG — a bipartite ladder reads
 * faster on a projector than a force simulation and needs no dependency.
 * Superseded claims' edges are greyed; dropped (uncertainty) claims sit in
 * the claim column with a dashed edge to the id they cited, or none. */

export type NodeKind = "doc" | "chunk" | "claim";
export type EdgeState = "live" | "superseded" | "dropped";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  sublabel?: string;
  state: "live" | "superseded" | "dropped";
}

export interface GraphEdge {
  from: string;
  to: string;
  state: EdgeState;
}

export interface Graph {
  docs: GraphNode[];
  chunks: GraphNode[];
  claims: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraph(claims: Claim[], evidence: Record<string, EvidenceHit>, diff: ClaimDiff | undefined): Graph {
  const docs = new Map<string, GraphNode>();
  const chunks = new Map<string, GraphNode>();
  const claimNodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const chunkToDoc = new Map<string, string>();

  for (const claim of claims) {
    const superseded = diff?.superseded.includes(claim.claim_id) ?? false;
    const dropped = claim.status === "uncertainty";
    const state = dropped ? "dropped" : superseded ? "superseded" : "live";
    const claimNodeId = `claim:${claim.claim_id}`;
    claimNodes.push({
      id: claimNodeId,
      kind: "claim",
      label: claim.text,
      sublabel: claim.citation_id ?? "no citation",
      state,
    });

    if (!claim.citation_id) continue;
    const hit = evidence[claim.citation_id];
    const parsed = parseCitation(claim.citation_id);
    const docId = hit?.doc_id ?? parsed?.docId ?? claim.citation_id;
    const chunkNodeId = `chunk:${claim.citation_id}`;
    const docNodeId = `doc:${docId}`;

    chunkToDoc.set(chunkNodeId, docNodeId);
    if (!chunks.has(chunkNodeId)) {
      chunks.set(chunkNodeId, {
        id: chunkNodeId,
        kind: "chunk",
        label: `§${hit?.section ?? parsed?.section ?? "?"}`,
        sublabel: hit?.heading ?? (hit ? undefined : "not retrieved"),
        state: hit ? "live" : "dropped",
      });
    }
    if (!docs.has(docNodeId)) {
      docs.set(docNodeId, {
        id: docNodeId,
        kind: "doc",
        label: docId,
        sublabel: hit?.doc_title ?? undefined,
        state: hit ? "live" : "dropped",
      });
    }
    edges.push({ from: claimNodeId, to: chunkNodeId, state });
  }

  // One chunk -> document edge per chunk, coloured by the claims that cite
  // it: live if any live claim does, superseded if only superseded claims
  // do (greyed, per F13), dropped if the chunk was never retrieved.
  for (const chunk of chunks.values()) {
    const docNodeId = chunkToDoc.get(chunk.id)!;
    const citing = edges.filter((e) => e.to === chunk.id).map((e) => e.state);
    let edgeState: EdgeState = "live";
    if (chunk.state === "dropped") edgeState = "dropped";
    else if (citing.length > 0 && citing.every((s) => s === "superseded")) {
      edgeState = "superseded";
      chunk.state = "superseded";
    }
    edges.push({ from: chunk.id, to: docNodeId, state: edgeState });
  }

  return { docs: [...docs.values()], chunks: [...chunks.values()], claims: claimNodes, edges };
}

const COL_X = { doc: 90, chunk: 300, claim: 520 } as const;
const ROW_H = 44;
const WIDTH = 720;
const TOP = 28;

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export function EvidenceGraph({
  claims,
  evidence,
  diff,
}: {
  claims: Claim[];
  evidence: Record<string, EvidenceHit>;
  diff: ClaimDiff | undefined;
}) {
  const graph = buildGraph(claims, evidence, diff);
  if (graph.claims.length === 0) {
    return <div className="fanout-empty">No claims yet — the graph fills in as claims are verified.</div>;
  }

  const rows = Math.max(graph.docs.length, graph.chunks.length, graph.claims.length);
  const height = TOP + rows * ROW_H + 8;
  const pos = new Map<string, { x: number; y: number }>();
  const place = (nodes: GraphNode[], x: number) => {
    const offset = ((rows - nodes.length) * ROW_H) / 2;
    nodes.forEach((n, i) => pos.set(n.id, { x, y: TOP + offset + i * ROW_H + ROW_H / 2 }));
  };
  place(graph.docs, COL_X.doc);
  place(graph.chunks, COL_X.chunk);
  place(graph.claims, COL_X.claim);

  return (
    <svg
      className="evidence-graph"
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label="Evidence graph: documents, chunks and claims for the current answer"
    >
      <text x={COL_X.doc} y={14} className="graph-column-label" textAnchor="middle">
        documents
      </text>
      <text x={COL_X.chunk} y={14} className="graph-column-label" textAnchor="middle">
        chunks
      </text>
      <text x={COL_X.claim} y={14} className="graph-column-label" textAnchor="middle">
        claims
      </text>
      {graph.edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const x1 = Math.min(a.x, b.x) + 60;
        const x2 = Math.max(a.x, b.x) - 60;
        const [ya, yb] = a.x < b.x ? [a.y, b.y] : [b.y, a.y];
        return (
          <path
            key={i}
            className={`graph-edge graph-edge-${e.state}`}
            d={`M ${x1} ${ya} C ${x1 + 40} ${ya}, ${x2 - 40} ${yb}, ${x2} ${yb}`}
            fill="none"
          />
        );
      })}
      {[...graph.docs, ...graph.chunks, ...graph.claims].map((n) => {
        const p = pos.get(n.id)!;
        const w = n.kind === "claim" ? 190 : 120;
        return (
          <g key={n.id} className={`graph-node graph-node-${n.kind} graph-node-${n.state}`}>
            <rect x={p.x - w / 2} y={p.y - 16} width={w} height={32} rx={4} />
            <text x={p.x} y={n.sublabel ? p.y - 2 : p.y + 4} textAnchor="middle" className="graph-node-label">
              {truncate(n.label, n.kind === "claim" ? 30 : 18)}
            </text>
            {n.sublabel && (
              <text x={p.x} y={p.y + 11} textAnchor="middle" className="graph-node-sublabel">
                {truncate(n.sublabel, n.kind === "claim" ? 30 : 20)}
              </text>
            )}
            <title>
              {n.label}
              {n.sublabel ? `\n${n.sublabel}` : ""}
              {`\n${n.state}`}
            </title>
          </g>
        );
      })}
    </svg>
  );
}
