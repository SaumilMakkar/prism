import { useEffect, useState } from "react";
import { AnswerPanel } from "./components/AnswerPanel";
import { ControllerLamp } from "./components/ControllerLamp";
import { EvidenceDrawer } from "./components/EvidenceDrawer";
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

export default function App() {
  const { state, send, startNewUtterance, loadHealth } = usePreludeSession();
  const [draftText, setDraftText] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [openCitation, setOpenCitation] = useState<Claim | null>(null);
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

  const version = state.claims.reduce((max, c) => Math.max(max, c.version), 1);
  const diff = state.lastTurn?.diff;

  let costSummary = "";
  if (diff && state.claims.length > 0) {
    if (diff.added.length === 0 && diff.superseded.length === 0) {
      costSummary = "re-rendered from stored claims, 0 retrievals";
    } else if (diff.added.length > 0) {
      const n = diff.added.length;
      costSummary = `1 targeted query, ${n} claim${n === 1 ? "" : "s"} added`;
    }
  }

  return (
    <div className="app-shell" data-tour-active={tour.running ? tour.step.target : undefined}>
      <Header
        health={state.health}
        cost={state.cost}
        onTour={tour.start}
        onMic={() => setMicActive((v) => !v)}
        micActive={micActive}
      />

      <div data-tour-target="ruler">
        <TranscriptBand utterance={state.current} draftText={draftText} />
      </div>

      <MicInput
        onFinal={(text) => send(text)}
        onDraft={setDraftText}
        active={micActive}
        setActive={setMicActive}
      />
      {state.error && <div className="error-banner">{state.error}</div>}

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
            <ControllerLamp turn={state.lastTurn} />
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
          <TelemetryPane events={state.telemetry} cost={state.cost} />
        </div>
      </div>

      {openCitation && <EvidenceDrawer claim={openCitation} onClose={() => setOpenCitation(null)} />}

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
