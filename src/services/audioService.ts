/**
 * Audio Service for Voice Feedback / Text to Speech (TTS)
 */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  interrupt?: boolean;
  onError?: (error: any) => void;
}

export class AudioService {
  public static speak(text: string, options: SpeakOptions = {}): boolean {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return false;
    }

    const synth = window.speechSynthesis;
    const { rate = 1.0, pitch = 1.0, interrupt = false, onError } = options;

    try {
      if (interrupt) {
        synth.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      
      if (onError) {
        utterance.onerror = (event) => onError(event);
      }

      synth.speak(utterance);
      return true;
    } catch (error) {
      if (onError) {
        onError(error);
      }
      return false;
    }
  }
}
