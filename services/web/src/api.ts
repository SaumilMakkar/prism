const API_BASE = "/api";

export interface Claim {
  claim_id: string;
  text: string;
  citation_id: string | null;
  quote: string | null;
  status: "verified" | "uncertainty";
  reason_code: string | null;
  version: number;
  sub_intent: string | null;
}

export interface ClaimDiff {
  added: string[];
  superseded: string[];
  unchanged: string[];
}

export interface TurnResponse {
  trace_id: string;
  decision: "wait" | "retrieve" | "no_retrieval";
  reason_code: string;
  claims: Claim[];
  diff: ClaimDiff;
}

export async function startSession(): Promise<{ session_id: string; token: string }> {
  const resp = await fetch(`${API_BASE}/session/start`, { method: "POST" });
  if (!resp.ok) throw new Error(`session/start failed: ${resp.status}`);
  return resp.json();
}

export async function sendChunk(
  token: string,
  chunkIndex: number,
  text: string
): Promise<TurnResponse> {
  const resp = await fetch(`${API_BASE}/turn/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunk_index: chunkIndex, text }),
  });
  if (!resp.ok) throw new Error(`turn failed: ${resp.status}`);
  return resp.json();
}
