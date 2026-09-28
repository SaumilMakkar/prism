import { TelemetryEvent } from "../types";

interface Stage {
  label: string;
  ms: number;
}

function stagesFor(events: TelemetryEvent[], traceId: string): Stage[] {
  const traceEvents = events.filter((e) => e.trace_id === traceId);
  const sum = (event: string) =>
    traceEvents.filter((e) => e.event === event).reduce((acc, e) => acc + (e.latency_ms ?? 0), 0);

  return [
    { label: "controller", ms: sum("controller_decision") },
    { label: "decompose", ms: sum("decompose_completed") },
    { label: "search", ms: sum("retrieval_completed") },
    { label: "synthesize", ms: sum("synthesis_completed") },
    { label: "verify", ms: sum("claim_verified") },
  ].filter((s) => s.ms > 0);
}

/** Hand-rolled horizontal bars from real per-stage timings recorded by the
 * orchestrator (services/gateway/app/orchestrator/orchestrator.py) — no
 * chart library, no invented numbers. */
export function LatencyWaterfall({ events, traceId }: { events: TelemetryEvent[]; traceId: string | null }) {
  if (!traceId) return null;
  const stages = stagesFor(events, traceId);
  if (stages.length === 0) return null;
  const total = stages.reduce((a, s) => a + s.ms, 0);
  const maxMs = Math.max(...stages.map((s) => s.ms));

  return (
    <div className="latency-waterfall">
      <div className="latency-title">Latency &mdash; {Math.round(total)} ms total</div>
      {stages.map((s) => (
        <div key={s.label} className="latency-row">
          <span className="latency-label">{s.label}</span>
          <div className="latency-bar-track">
            <div className="latency-bar" style={{ width: `${(s.ms / maxMs) * 100}%` }} />
          </div>
          <span className="latency-ms">{Math.round(s.ms)} ms</span>
        </div>
      ))}
    </div>
  );
}
