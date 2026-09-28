import { CostResponse, DemoStream, HealthResponse, TelemetryEvent, TurnResponse } from "./types";

const API_BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`);
  if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
  return resp.json();
}

export async function getHealth(): Promise<HealthResponse> {
  return get<HealthResponse>("/healthz");
}

export async function startSession(): Promise<{ session_id: string; token: string }> {
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
  if (!resp.ok) throw new Error(`turn failed: ${resp.status}`);
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
