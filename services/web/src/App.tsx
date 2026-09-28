import { useState } from "react";
import { Claim, TurnResponse, sendChunk, startSession } from "./api";

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [input, setInput] = useState("");
  const [lastTurn, setLastTurn] = useState<TurnResponse | null>(null);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function ensureSession(): Promise<string> {
    if (token) return token;
    const { token: newToken } = await startSession();
    setToken(newToken);
    return newToken;
  }

  async function handleSend() {
    if (!input.trim()) return;
    setError(null);
    try {
      const t = await ensureSession();
      const result = await sendChunk(t, chunkIndex, input);
      setLastTurn(result);
      setClaims(result.claims);
      setChunkIndex((i) => i + 1);
      setInput("");
    } catch (e) {
      setError(String(e));
    }
  }

  function claimClass(claim: Claim): string {
    if (!lastTurn) return "unchanged";
    if (lastTurn.diff.superseded.includes(claim.claim_id)) return "superseded";
    if (lastTurn.diff.added.includes(claim.claim_id)) return "added";
    return "unchanged";
  }

  return (
    <div className="app">
      <h1>Prelude — Live Agent Assist</h1>
      <div className="subtitle">Retrieval that starts before the question ends.</div>

      <div className="panel">
        <div style={{ marginBottom: 8, fontSize: 13, color: "#8a90a0" }}>
          Send transcript chunks one at a time (simulating streaming speech). Each send is one
          controller decision.
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. My phone won't power on, I bought it abroad..."
        />
        <div>
          <button onClick={handleSend}>Send chunk #{chunkIndex}</button>
        </div>
        {error && <div style={{ color: "#d9534f", marginTop: 8 }}>{error}</div>}
      </div>

      {lastTurn && (
        <div className="panel">
          <div className="lamp-row">
            <span className={`lamp ${lastTurn.decision}`} />
            <strong>{lastTurn.decision.toUpperCase()}</strong>
            <span className="reason-code">{lastTurn.reason_code}</span>
          </div>
          <div style={{ fontSize: 12, color: "#8a90a0" }}>trace_id: {lastTurn.trace_id}</div>
        </div>
      )}

      <div className="panel">
        <div style={{ marginBottom: 8, fontWeight: 600 }}>Answer (claim graph)</div>
        {claims.length === 0 && (
          <div style={{ color: "#8a90a0", fontSize: 13 }}>No claims yet — send a chunk above.</div>
        )}
        {claims.map((claim) => (
          <div key={claim.claim_id} className={`claim ${claimClass(claim)}`}>
            <div>
              {claim.text}
              <span className={`status-badge ${claim.status}`}>{claim.status}</span>
            </div>
            {claim.citation_id && <div className="citation">[{claim.citation_id}] v{claim.version}</div>}
            {claim.quote && <div className="quote">&ldquo;{claim.quote}&rdquo;</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
