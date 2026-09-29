import { useEffect, useRef, useState } from "react";
import * as api from "../api";
import { motion } from "../motion";

export interface TourStep {
  stream: string;
  caption: string;
  target: string; // matches a data-tour-target attribute in App.tsx
}

// Order and streams match the eight moments in frontend_prompt.md's
// "Moments the UI must make legible" and the real files under
// evaluation/streams/ — captions never contain transcript text, answers,
// quotes or document IDs (those come from the stream itself at runtime).
export const TOUR_STEPS: TourStep[] = [
  { stream: "simple_power_on", caption: "Watch the ruler: retrieval fires while the sentence is still arriving.", target: "ruler" },
  { stream: "compound_warranty_and_charging", caption: "One utterance fans out into parallel sub-queries.", target: "fanout" },
  { stream: "late_detail_warranty_abroad", caption: "A late detail refines the answer as a diff — the rest stays.", target: "diff" },
  { stream: "presentation_say_that_again_shorter", caption: "A presentation turn re-renders with zero new retrievals.", target: "lamp" },
  { stream: "adversarial_injection", caption: "An injected citation gets caught and dropped by the verifier.", target: "dropped" },
  { stream: "no_evidence_camera_lens_cost", caption: "A question outside the corpus ends in graceful uncertainty.", target: "uncertainty" },
  { stream: "noise_mid_sentence_correction", caption: "A mid-sentence self-correction cancels the provisional retrieval.", target: "ruler" },
];

export function useGuidedTour(
  send: (text: string) => Promise<unknown>,
  startNewUtterance: (safeChunkIndex?: number | null) => void,
  onFinish: () => void
) {
  const [running, setRunning] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const cancelRef = useRef(false);

  async function runStep(i: number) {
    const step = TOUR_STEPS[i];
    let stream;
    try {
      stream = await api.getDemoStream(step.stream);
    } catch {
      return; // stream not available in this deployment — skip silently
    }
    // The stream's offline-labelled safe point drives the ruler's hollow
    // marker (moment 7: headroom as one number) — it is a label from the
    // committed eval stream, fetched at runtime, never bundled.
    startNewUtterance(stream.expected_safe_chunk_index ?? null);
    for (const chunk of stream.chunks) {
      if (cancelRef.current) return;
      await send(chunk);
      await new Promise((r) => setTimeout(r, 700));
    }
  }

  async function start() {
    cancelRef.current = false;
    setRunning(true);
    setStepIndex(0);
    await runStep(0);
  }

  async function next() {
    if (stepIndex + 1 >= TOUR_STEPS.length) {
      stop();
      onFinish();
      return;
    }
    const i = stepIndex + 1;
    setStepIndex(i);
    await runStep(i);
  }

  function back() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  function stop() {
    cancelRef.current = true;
    setRunning(false);
  }

  return { running, stepIndex, step: TOUR_STEPS[stepIndex], start, next, back, stop };
}

export function TourOverlay({
  step,
  index,
  total,
  onNext,
  onBack,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="tour-caption"
      initial={{ opacity: 0, y: 16, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: 8, x: "-50%", transition: { duration: 0.18 } }}
    >
      <span className="tour-step-count">
        {index + 1} / {total}
      </span>
      <span className="tour-text">{step.caption}</span>
      <div className="tour-controls">
        <button className="btn-quiet" onClick={onBack} disabled={index === 0}>
          Back
        </button>
        <button className="btn-quiet" onClick={onNext}>
          {index + 1 === total ? "Finish" : "Next"}
        </button>
        <button className="btn-quiet" onClick={onClose}>
          Esc
        </button>
      </div>
    </motion.div>
  );
}
