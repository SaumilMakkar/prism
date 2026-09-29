import { useEffect, useRef, useState } from "react";
import { chunkUtterance } from "../chunking";

// Web Speech API isn't in the standard TS lib; declare the minimal shape used.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
}
interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Mic mode (M) with a typing fallback for browsers without Web Speech
 * (Firefox, some Chromium builds) — so the judge can still "take the mic"
 * without a working microphone. Only FINAL speech results are posted;
 * interim results only update the live preview (draftText). Posting every
 * interim delta as its own chunk (as the brief's literal text suggests)
 * would flood the controller with near-duplicate fragments every ~100ms.
 * Instead each final result is cut into short clause-sized chunks
 * (src/chunking.ts) and posted in order, so the ruler shows real ticks and
 * the controller sees the clause boundary it fires on — the same shape as
 * the committed eval streams. Documented in services/web/DESIGN.md. */
export function MicInput({
  onFinal,
  onDraft,
  active,
  setActive,
}: {
  onFinal: (text: string) => Promise<unknown> | void;
  onDraft: (text: string) => void;
  active: boolean;
  setActive: (active: boolean) => void;
}) {
  const [supported, setSupported] = useState(true);
  const [typed, setTyped] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Chunks are posted strictly in order; a new final result queues behind
  // the previous one so the controller never sees chunk 3 before chunk 2.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  function postChunked(text: string) {
    const chunks = chunkUtterance(text);
    queueRef.current = queueRef.current.then(async () => {
      for (const chunk of chunks) {
        try {
          await onFinal(chunk);
        } catch {
          return; // send() already surfaced the error banner
        }
      }
    });
  }

  useEffect(() => {
    setSupported(getSpeechRecognition() !== null);
  }, []);

  useEffect(() => {
    if (!active || !supported) return;
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          postChunked(transcript.trim());
          onDraft("");
        } else {
          interim += transcript;
        }
      }
      if (interim) onDraft(interim.trim());
    };
    recognition.onend = () => setActive(false);
    recognition.onerror = () => setActive(false);
    recognitionRef.current = recognition;
    recognition.start();
    return () => recognition.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, supported]);

  function submitTyped() {
    if (!typed.trim()) return;
    postChunked(typed.trim());
    setTyped("");
    onDraft("");
  }

  if (!supported) {
    return (
      <div className="mic-fallback">
        <input
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            onDraft(e.target.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && submitTyped()}
          placeholder="Web Speech unavailable in this browser — type a chunk and press Enter"
        />
        <button className="btn-quiet" onClick={submitTyped}>
          Send
        </button>
      </div>
    );
  }

  return (
    <div className="mic-fallback">
      <input
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
          onDraft(e.target.value);
        }}
        onKeyDown={(e) => e.key === "Enter" && submitTyped()}
        placeholder={active ? "Listening…" : "Press Mic, or type a chunk and press Enter"}
      />
      <button className="btn-quiet" onClick={submitTyped}>
        Send
      </button>
    </div>
  );
}
