/**
 * Audio Service for Voice Feedback / Text to Speech (TTS)
 */

export interface SpeakOptions {
  rate?: number;
  pitch?: number;
  interrupt?: boolean;
  voiceURI?: string;
  onError?: (error: any) => void;
}

export class AudioService {
  public static speak(text: string, options: SpeakOptions = {}): boolean {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return false;
    }

    const synth = window.speechSynthesis;
    const { rate = 1.0, pitch = 1.0, interrupt = false, voiceURI, onError } = options;

    try {
      if (interrupt) {
        synth.cancel();
      }
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;

      if (voiceURI) {
        const voices = synth.getVoices();
        const voice = voices.find((v) => v.voiceURI === voiceURI) || voices.find((v) => v.lang === voiceURI);
        if (voice) {
          utterance.voice = voice;
        }
      }

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

  /**
   * Lists the browser's available speech voices. Returns [] in environments
   * without speechSynthesis support. If the voice list is not yet populated,
   * it triggers a refresh and resolves when voices arrive.
   */
  public static getVoices(): SpeechSynthesisVoice[] {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return [];
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      return voices;
    }
    // Force async population (required on Chrome/Edge).
    window.speechSynthesis.getVoices();
    return [];
  }

  /**
   * Picks a preferred voice. Prioritizes an explicit voiceURI match, then
   * prefers a natural English voice, then falls back to the first voice.
   */
  public static selectVoice(voiceURI?: string): SpeechSynthesisVoice | null {
    const voices = AudioService.getVoices();
    if (voices.length === 0) return null;

    if (voiceURI) {
      const match = voices.find((v) => v.voiceURI === voiceURI);
      if (match) return match;
    }

    const preferredNames = ["natural", "enhanced", "premium", "neural", "google"];
    for (const name of preferredNames) {
      const match = voices.find((v) => v.name.toLowerCase().includes(name) && v.lang.toLowerCase().startsWith("en"));
      if (match) return match;
    }

    return voices.find((v) => v.lang.toLowerCase().startsWith("en")) || voices[0];
  }
}
