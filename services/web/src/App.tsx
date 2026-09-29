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
import { Mark } from "./components/Mark";
import { AnimatePresence, PageShell, appear, motion } from "./motion";
import { usePreludeSession } from "./store";
import { Claim, reasonSentence } from "./types";

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
    <PageShell>
    <div className="app-shell" data-tour-active={tour.running ? tour.step.target : undefined}>
      <AnimatePresence>
        {state.connection === "unknown" && (
          <motion.div
            className="connecting"
            role="status"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.35 } }}
          >
            <motion.span
              animate={{ opacity: [1, 0.35, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              style={{ display: "inline-flex" }}
            >
              <Mark size={36} />
            </motion.span>
            Connecting to the gateway
          </motion.div>
        )}
      </AnimatePresence>
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

      <AnimatePresence>
        {state.expired && (
          <motion.div className="expired-banner" role="status" {...appear}>
            Session expired; nothing was kept.
            <button className="btn-quiet" onClick={() => ensureSession()}>
              New session
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
      <AnimatePresence>
        {state.error && (
          <motion.div className="error-banner" role="alert" {...appear}>
            {state.error}. Check that the gateway is up (make up) and try again.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="main-grid">
        <div className="answer-column" data-tour-target="diff">
          <AnswerPanel
            claims={state.claims}
            diff={diff}
            version={version}
            costSummary={costSummary}
            waitingNote={
              state.lastTurn?.decision === "wait" ? reasonSentence(state.lastTurn.reason_code) : null
            }
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

      <AnimatePresence>
        {openCitation && (
          <EvidenceDrawer
            key="drawer"
            claim={openCitation}
            hit={openCitation.citation_id ? state.evidence[openCitation.citation_id] : undefined}
            superseded={diff?.superseded.includes(openCitation.claim_id) ?? false}
            onClose={() => setOpenCitation(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {tour.running && (
          <TourOverlay
            key="tour"
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
        {tourJustFinished && (
          <motion.div
            key="tour-finished"
            className="tour-caption tour-finished"
            initial={{ opacity: 0, y: 16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 8, x: "-50%" }}
          >
            Your turn — take the mic.
          </motion.div>
        )}
      </AnimatePresence>

      <PrivacyNotice />
    </div>
    </PageShell>
  );
}
