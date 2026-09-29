import { useCallback, useEffect, useState } from "react";
import { AnswerPanel } from "./components/AnswerPanel";
import { ControllerLamp } from "./components/ControllerLamp";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
import { EvidenceGraph } from "./components/EvidenceGraph";
import { TourOverlay, useGuidedTour } from "./components/GuidedTour";
import { Header } from "./components/Header";
import { LatencyWaterfall } from "./components/LatencyWaterfall";
import { MicInput } from "./components/MicInput";
import { PrivacyNotice } from "./components/PrivacyNotice";
import { SubQueryFanout } from "./components/SubQueryFanout";
import { TelemetryPane } from "./components/TelemetryPane";
import { TranscriptBand } from "./components/TranscriptBand";
import { usePreludeSession } from "./store";
import { Claim } from "./types";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export default function App() {
  const { state, send, startNewUtterance, loadHealth, ensureSession, expireSession } = usePreludeSession();
  const [draftText, setDraftText] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [openCitation, setOpenCitation] = useState<Claim | null>(null);
  const [showGraph, setShowGraph] = useState(true);
  const [tourJustFinished, setTourJustFinished] = useState(false);

  const tour = useGuidedTour(send, startNewUtterance, () => {
    setTourJustFinished(true);
    setTimeout(() => setTourJustFinished(false), 4000);
  });

  useEffect(() => {
    loadHealth();
    const id = setInterval(loadHealth, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard: M toggles mic, T starts the tour, Esc closes drawers (each
  // drawer handles its own Esc). Ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === "m" || e.key === "M") setMicActive((v) => !v);
      if ((e.key === "t" || e.key === "T") && !tour.running) tour.start();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour]);

  const onExpired = useCallback(() => {
    setOpenCitation(null);
    expireSession();
  }, [expireSession]);

  const version = state.claims.reduce((max, c) => Math.max(max, c.version), 1);
  const diff = state.lastTurn?.diff;

  let costSummary = "";
  if (diff && state.claims.length > 0) {
    if (diff.added.length === 0 && diff.superseded.length === 0) {
      costSummary = "re-rendered from stored claims, 0 retrievals";
    } else if (diff.added.length > 0) {
      const n = diff.added.length;
      const cached = state.telemetry.filter(
        (e) => e.trace_id === state.lastTurn?.trace_id && e.event === "retrieval_completed" && e.cache_hit
      ).length;
      const searched = state.telemetry.filter(
        (e) => e.trace_id === state.lastTurn?.trace_id && e.event === "retrieval_completed" && !e.cache_hit
      ).length;
      const queries =
        searched + cached === 0
          ? ""
          : `${searched} targeted quer${searched === 1 ? "y" : "ies"}${cached ? `, ${cached} from cache` : ""}, `;
      costSummary = `${queries}${n} claim${n === 1 ? "" : "s"} added`;
    }
  }

  return (
    <div className="app-shell" data-tour-active={tour.running ? tour.step.target : undefined}>
      <Header
        health={state.health}
        connection={state.connection}
        sessionId={state.sessionId}
        sessionStartedAt={state.sessionStartedAt}
        sessionTtlSeconds={state.sessionTtlSeconds}
        cost={state.cost}
        onTour={tour.start}
        onMic={() => setMicActive((v) => !v)}
        micActive={micActive}
        onExpired={onExpired}
      />

      {state.expired && (
        <div className="expired-banner" role="status">
          Session expired; nothing was kept.
          <button className="btn-quiet" onClick={() => ensureSession()}>
            New session
          </button>
        </div>
      )}

      <div data-tour-target="ruler">
        <TranscriptBand
          utterance={state.current}
          utterances={state.utterances}
          draftText={draftText}
          events={state.telemetry}
        />
      </div>

      <MicInput
        onFinal={(text) => send(text)}
        onDraft={setDraftText}
        active={micActive}
        setActive={setMicActive}
      />
      {state.error && (
        <div className="error-banner" role="alert">
          {state.error}. Check that the gateway is up (make up) and try again.
        </div>
      )}

      <div className="main-grid">
        <div className="answer-column" data-tour-target="diff">
          <AnswerPanel
            claims={state.claims}
            diff={diff}
            version={version}
            costSummary={costSummary}
            onOpenCitation={setOpenCitation}
          />
        </div>

        <div className="engine-column">
          <div data-tour-target="lamp">
            <ControllerLamp turn={state.lastTurn} events={state.telemetry} />
          </div>
          <div className="engine-section" data-tour-target="fanout">
            <div className="engine-section-title">
              Sub-queries {state.current ? `(utterance ${state.utterances.length + 1})` : ""}
            </div>
            <SubQueryFanout
              utteranceText={state.current?.chunks.map((c) => c.text).join(" ") ?? ""}
              events={state.telemetry}
              traceId={state.lastTurn?.trace_id ?? null}
              claims={state.claims}
            />
          </div>
          <div className="engine-section">
            <LatencyWaterfall events={state.telemetry} traceId={state.lastTurn?.trace_id ?? null} />
          </div>
          <div className="engine-section">
            <button className="engine-section-toggle" onClick={() => setShowGraph((v) => !v)} aria-expanded={showGraph}>
              Evidence graph {showGraph ? "▾" : "▸"}
            </button>
            {showGraph && <EvidenceGraph claims={state.claims} evidence={state.evidence} diff={diff} />}
          </div>
          <TelemetryPane events={state.telemetry} cost={state.cost} />
        </div>
      </div>

      {openCitation && (
        <EvidenceDrawer
          claim={openCitation}
          hit={openCitation.citation_id ? state.evidence[openCitation.citation_id] : undefined}
          superseded={diff?.superseded.includes(openCitation.claim_id) ?? false}
          onClose={() => setOpenCitation(null)}
        />
      )}

      {tour.running && (
        <TourOverlay
          step={tour.step}
          index={tour.stepIndex}
          total={7}
          onNext={tour.next}
          onBack={tour.back}
          onClose={() => {
            tour.stop();
          }}
        />
      )}
      {tourJustFinished && <div className="tour-caption tour-finished">Your turn — take the mic.</div>}

      <PrivacyNotice />
    </div>
  );
}
