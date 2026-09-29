import { HealthResponse } from "../types";

export function Header({
  health,
  cost,
  onTour,
  onMic,
  micActive,
}: {
  health: HealthResponse | null;
  cost: number;
  onTour: () => void;
  onMic: () => void;
  micActive: boolean;
}) {
  return (
    <header className="header">
      <div className="header-left">
        <span className="brand">Prelude</span>
        {health && (
          <>
            <span className="badge">mode: {health.ai_mode ?? "unknown"}</span>
            <span className="badge">ml: {health.ml_backend ?? "unknown"}</span>
            <span className={`badge ${health.status === "ok" ? "badge-ok" : "badge-down"}`}>
              gateway {health.status === "ok" ? "ok" : "down"}
            </span>
          </>
        )}
      </div>
      <div className="header-right">
        <span className="cost">cost ${cost.toFixed(4)}</span>
        <button className="btn-quiet" onClick={onTour}>
          Tour
        </button>
        <button className={`btn-quiet ${micActive ? "btn-active" : ""}`} onClick={onMic}>
          {micActive ? "Mic on" : "Mic"}
        </button>
      </div>
    </header>
  );
}
