import { useEffect, useState } from "react";
import { Connection } from "../store";
import { HealthResponse } from "../types";

/** Same hash the gateway uses for telemetry (sha256, first 16 hex chars —
 * services/gateway/app/security/security.py), so the id shown here is the
 * one a judge will find in the telemetry pane's session_id_hash field. */
async function hashSessionId(sessionId: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(sessionId);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
  } catch {
    return sessionId.slice(0, 8);
  }
}

function formatCountdown(remainingMs: number): string {
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Header({
  health,
  connection,
  sessionId,
  sessionStartedAt,
  sessionTtlSeconds,
  cost,
  onTour,
  onMic,
  micActive,
  onExpired,
}: {
  health: HealthResponse | null;
  connection: Connection;
  sessionId: string | null;
  sessionStartedAt: number | null;
  sessionTtlSeconds: number | null;
  cost: number;
  onTour: () => void;
  onMic: () => void;
  micActive: boolean;
  onExpired: () => void;
}) {
  const [hashed, setHashed] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!sessionId) {
      setHashed(null);
      return;
    }
    let cancelled = false;
    hashSessionId(sessionId).then((h) => {
      if (!cancelled) setHashed(h);
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const ttlMs = sessionStartedAt !== null && sessionTtlSeconds !== null ? sessionTtlSeconds * 1000 : null;
  const remainingMs = ttlMs !== null && sessionStartedAt !== null ? sessionStartedAt + ttlMs - now : null;

  const counting = ttlMs !== null;
  const expired = remainingMs !== null && remainingMs <= 0;

  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    if (expired) onExpired();
  }, [expired, onExpired]);

  const gatewayLabel =
    connection === "down" ? "gateway unreachable, retrying" : connection === "ok" ? "gateway ok" : "gateway …";

  return (
    <header className="header">
      <div className="header-left">
        <span className="brand">Prelude</span>
        {hashed && (
          <span className="badge" title="Session id as hashed by the gateway; matches telemetry session_id_hash">
            session {hashed.slice(0, 8)}…
          </span>
        )}
        {health && (
          <>
            <span className="badge">mode {health.ai_mode ?? "unknown"}</span>
            <span className="badge">ml {health.ml_backend ?? "unknown"}</span>
          </>
        )}
        <span className={`badge ${connection === "ok" ? "badge-ok" : connection === "down" ? "badge-down" : ""}`}>
          {gatewayLabel}
        </span>
        {remainingMs !== null && (
          <span className="badge" title="Time until this session's Redis state expires (nothing is kept after)">
            expires in {formatCountdown(remainingMs)}
          </span>
        )}
      </div>
      <div className="header-right">
        <span className="cost" title="Cumulative LLM spend this session, from ai-service's cost meter">
          cost ${cost.toFixed(4)}
        </span>
        <button className="btn-quiet" onClick={onTour} title="Guided tour (T)">
          Tour
        </button>
        <button className={`btn-quiet ${micActive ? "btn-active" : ""}`} onClick={onMic} title="Toggle mic (M)">
          {micActive ? "Mic on" : "Mic"}
        </button>
      </div>
    </header>
  );
}
