import { useEffect, useRef, useState } from "react";
import { AudioService } from "../services/audioService";

export interface VoiceControlOptions {
  enabled: boolean;
  onCommand: (command: "START" | "PAUSE" | "STOP") => void;
}

export function useVoiceControl({ enabled, onCommand }: VoiceControlOptions) {
  const recognitionRef = useRef<any>(null);
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
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

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Restart if still enabled and the current ref is this recognition instance
      if (enabled && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch (e) {
          console.error("Failed to restart speech recognition:", e);
        }
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
    };

    recognition.onresult = (event: any) => {
      const resultsLength = event.results.length;
      for (let i = event.resultIndex; i < resultsLength; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          console.log("Voice control transcript:", transcript);

          if (transcript.includes("spectra start") || transcript.includes("spectra resume")) {
            AudioService.speak("Workout started", { interrupt: true });
            onCommand("START");
          } else if (transcript.includes("spectra pause")) {
            AudioService.speak("Workout paused", { interrupt: true });
            onCommand("PAUSE");
          } else if (
            transcript.includes("end workout") ||
            transcript.includes("spectra stop") ||
            transcript.includes("spectra end")
          ) {
            AudioService.speak("Ending workout", { interrupt: true });
            onCommand("STOP");
          }
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
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
      try {
        recognition.stop();
      } catch (e) {
        // ignore
      }
    };
  }, [enabled, onCommand]);

  return { isListening };
}
