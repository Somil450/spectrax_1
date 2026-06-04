/**
 * Audio Service for Voice Feedback / Text to Speech (TTS)
 */
export class AudioService {
  private static synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

  public static speak(text: string): void {
    if (!this.synth) return;
    try {
      this.synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      this.synth.speak(utterance);
    } catch (error) {
      console.error("Voice synthesis failed:", error);
    }
  }
}
