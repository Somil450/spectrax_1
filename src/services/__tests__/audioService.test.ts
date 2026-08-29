import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AudioService } from "../audioService";

describe("AudioService", () => {
  const originalSpeech = (window as any).speechSynthesis;
  const originalUtterance = (global as any).SpeechSynthesisUtterance;

  beforeEach(() => {
    (global as any).SpeechSynthesisUtterance = class {
      text = "";
      rate = 1;
      pitch = 1;
      voice: SpeechSynthesisVoice | null = null;
      onerror: any = null;
      constructor(text: string) {
        this.text = text;
      }
    };
    Object.defineProperty(window, "speechSynthesis", {
      value: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "speechSynthesis", {
      value: originalSpeech,
      configurable: true,
    });
    (global as any).SpeechSynthesisUtterance = originalUtterance;
    vi.restoreAllMocks();
  });

  const makeVoice = (overrides: Partial<SpeechSynthesisVoice> = {}): SpeechSynthesisVoice =>
    ({
      name: "Test Voice",
      lang: "en-US",
      voiceURI: "test://voice-1",
      localService: false,
      default: false,
      ...overrides,
    } as SpeechSynthesisVoice);

  it("returns false when speechSynthesis is unavailable", () => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    expect(AudioService.speak("Hello")).toBe(false);
  });

  it("speaks with the default options", () => {
    const synth = window.speechSynthesis as any;
    const ok = AudioService.speak("Go lower");
    expect(ok).toBe(true);
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.text).toBe("Go lower");
    expect(utterance.rate).toBe(1.0);
  });

  it("applies the selected voice by voiceURI", () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([
      makeVoice({ name: "Samantha", voiceURI: "com.apple.ttsbundle.Samantha", lang: "en-US" }),
      makeVoice({ name: "Daniel", voiceURI: "com.apple.ttsbundle.Daniel", lang: "en-GB" }),
    ]);

    AudioService.speak("Hold it", { voiceURI: "com.apple.ttsbundle.Daniel" });
    const utterance = synth.speak.mock.calls[0][0] as SpeechSynthesisUtterance;
    expect(utterance.voice.voiceURI).toBe("com.apple.ttsbundle.Daniel");
  });

  it("speaks even when the requested voiceURI does not exist", () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([makeVoice()]);
    const ok = AudioService.speak("Keep going", { voiceURI: "missing://voice" });
    expect(ok).toBe(true);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("cancels the previous utterance when interrupt is set", () => {
    const synth = window.speechSynthesis as any;
    AudioService.speak("Interrupt me", { interrupt: true });
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });

  it("selectVoice prefers an explicit match, then natural English", () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([
      makeVoice({ name: "Google US English", voiceURI: "google://en", lang: "en-US" }),
      makeVoice({ name: "Robot", voiceURI: "robot://x", lang: "de-DE" }),
    ]);

    const explicit = AudioService.selectVoice("google://en");
    expect(explicit?.voiceURI).toBe("google://en");

    const auto = AudioService.selectVoice(undefined);
    expect(auto?.lang.toLowerCase().startsWith("en")).toBe(true);
  });

  it("selectVoice returns null when no voices exist", () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([]);
    expect(AudioService.selectVoice(undefined)).toBeNull();
  });

  it("getVoices returns [] without speechSynthesis", () => {
    Object.defineProperty(window, "speechSynthesis", { value: undefined, configurable: true });
    expect(AudioService.getVoices()).toEqual([]);
  });
});
