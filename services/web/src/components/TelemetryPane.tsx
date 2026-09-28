import { useState } from "react";
import * as api from "../api";
import { TelemetryEvent } from "../types";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/jsonl" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TelemetryPane({ events, cost }: { events: TelemetryEvent[]; cost: number }) {
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [filterTrace, setFilterTrace] = useState("");
  const [selected, setSelected] = useState<TelemetryEvent | null>(null);

  const filtered = filterTrace ? events.filter((e) => e.trace_id.includes(filterTrace)) : events;

  async function handleVerify() {
    try {
      const { valid, event_count } = await api.verifyChain();
      setVerifyResult(valid ? `verified, ${event_count} events` : `broken chain (${event_count} events)`);
    } catch (e) {
      setVerifyResult(`verify failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleExport() {
    const jsonl = events.map((e) => JSON.stringify(e)).join("\n");
    download("telemetry.jsonl", jsonl);
  }

  return (
    <section className="telemetry-pane">
      <div className="telemetry-header">
        <span>Telemetry</span>
        <button className="btn-quiet" onClick={handleVerify}>
          Verify chain
        </button>
        <button className="btn-quiet" onClick={handleExport}>
          Export JSONL
        </button>
      </div>
      {verifyResult && <div className="telemetry-verify-result">{verifyResult}</div>}
      <div className="cost-meter">
        cost this session: ${cost.toFixed(4)} {cost === 0 && "(offline/replay)"}
      </div>
      <input
        className="telemetry-filter"
        placeholder="filter by trace id"
        value={filterTrace}
        onChange={(e) => setFilterTrace(e.target.value)}
      />
      <div className="telemetry-list">
        {filtered.slice(-200).map((e, i) => (
          <div key={i} className="telemetry-row" onClick={() => setSelected(e)}>
            <span className="telemetry-ts">{e.ts?.slice(11, 19)}</span>
            <span className="telemetry-trace">{e.trace_id.slice(0, 8)}</span>
            <span className="telemetry-event">{e.event}</span>
          </div>
        ))}
        {filtered.length === 0 && <div className="telemetry-empty">No events yet.</div>}
      </div>
      {selected && (
        <div className="drawer-backdrop" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSelected(null)}>
              Esc
            </button>
            <pre className="raw-json">{JSON.stringify(selected, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
