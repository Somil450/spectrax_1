import { useEffect, useRef, useState } from "react";
import { AudioService } from "../services/audioService";

// Minimal interface for the browser SpeechRecognition API (not in all TS lib versions)
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((ev: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface VoiceControlOptions {
  enabled: boolean;
  onCommand: (command: "START" | "PAUSE" | "STOP") => void;
}

/** Minimum confidence score (0–1) required to act on a recognized phrase. */
const CONFIDENCE_THRESHOLD = 0.75;

export function useVoiceControl({ enabled, onCommand }: VoiceControlOptions) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [isListening, setIsListening] = useState(false);

  // Keep a stable ref to the latest onCommand callback so the effect does not
  // need to re-run (and restart recognition) every time the parent re-renders.
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      console.warn("SpeechRecognition is not supported in this browser.");
      return;
    }

    if (!enabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      return;
    }

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // Tracks whether this effect's cleanup has run — prevents stale restarts.
    let destroyed = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart so recognition runs for the whole workout session.
      if (!destroyed) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart speech recognition:", e);
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // "no-speech" fires whenever there is silence — suppress it to avoid noise.
      if (event.error === "no-speech") return;
      // Microphone permission denied — nothing we can do, don't restart.
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        console.warn("Microphone permission denied. Voice commands disabled.");
        destroyed = true;
        return;
      }
      console.error("Speech recognition error:", event.error);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const resultsLength = event.results.length;
      for (let i = event.resultIndex; i < resultsLength; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;

        const confidence = result[0].confidence;
        // Ignore low-confidence results to prevent accidental triggers.
        if (confidence < CONFIDENCE_THRESHOLD) continue;

        const transcript = result[0].transcript.trim().toLowerCase();

        if (transcript.includes("spectra start") || transcript.includes("spectra resume")) {
          AudioService.speak("Workout started", { interrupt: true });
          onCommandRef.current("START");
        } else if (transcript.includes("spectra pause")) {
          AudioService.speak("Workout paused", { interrupt: true });
          onCommandRef.current("PAUSE");
        } else if (
          transcript.includes("end workout") ||
          transcript.includes("spectra stop") ||
          transcript.includes("spectra end")
        ) {
          AudioService.speak("Ending workout", { interrupt: true });
          onCommandRef.current("STOP");
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }

    return () => {
      destroyed = true;
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        // Ignore errors during cleanup (recognition may already be stopped).
      }
    };
  // onCommand is intentionally excluded — we access it via onCommandRef to keep
  // this effect stable and avoid restarting recognition on every render.
  }, [enabled]);

  return { isListening };
}
