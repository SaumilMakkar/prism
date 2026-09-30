import {
  CostResponse,
  DemoStream,
  HealthResponse,
  SessionStartResponse,
  TelemetryEvent,
  TurnResponse,
} from "./types";

const API_BASE = "/api";

/** "turn failed: 502 — ai-service returned 502: LLM provider error: …" —
 * the gateway passes a peer's reason through, so show it. */
async function errorDetail(resp: Response, prefix: string): Promise<string> {
  try {
    const body = await resp.json();
    const detail = typeof body?.detail === "string" ? body.detail : JSON.stringify(body);
    return `${prefix}: ${resp.status} — ${detail}`;
  } catch {
    return `${prefix}: ${resp.status}`;
  }
}

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
  return resp.json();
}

export async function getHealth(): Promise<HealthResponse> {
  return get<HealthResponse>("/healthz");
}

export async function startSession(): Promise<SessionStartResponse> {
  const resp = await fetch(`${API_BASE}/session/start`, { method: "POST" });
  if (!resp.ok) throw new Error(`session/start failed: ${resp.status}`);
  return resp.json();
}

export async function sendChunk(token: string, chunkIndex: number, text: string): Promise<TurnResponse> {
  const resp = await fetch(`${API_BASE}/turn/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chunk_index: chunkIndex, text }),
  });
  if (!resp.ok) throw new Error(await errorDetail(resp, "turn failed"));
  return resp.json();
}

export async function getTelemetry(token: string): Promise<{ events: TelemetryEvent[] }> {
  return get(`/telemetry/${token}`);
}

export async function verifyChain(): Promise<{ valid: boolean; event_count: number }> {
  return get("/telemetry/verify");
}

export async function getCost(token: string): Promise<CostResponse> {
  return get(`/cost/${token}`);
}

export async function listDemoStreams(): Promise<{ streams: string[] }> {
  return get("/demo/streams");
}

export async function getDemoStream(name: string): Promise<DemoStream> {
  return get(`/demo/streams/${name}`);
}
