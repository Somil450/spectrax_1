import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSpeechVoices } from "../useSpeechVoices";

describe("useSpeechVoices", () => {
  const originalSpeech = (window as any).speechSynthesis;

  beforeEach(() => {
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
    vi.restoreAllMocks();
  });

  it("exposes available voices and a chosen voice", () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([
      { name: "A", lang: "en-US", voiceURI: "a://1", localService: false, default: false },
      { name: "B", lang: "en-GB", voiceURI: "b://2", localService: false, default: false },
    ]);

    const { result } = renderHook(() => useSpeechVoices("b://2"));
    expect(result.current.voices).toHaveLength(2);
    expect(result.current.selectedVoice?.voiceURI).toBe("b://2");
  });

  it("subscribes to voiceschanged events", async () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([]);
    let onVoicesChanged: (() => void) | null = null;
    synth.addEventListener.mockImplementation((event: string, fn: () => void) => {
      if (event === "voiceschanged") onVoicesChanged = fn;
    });

    renderHook(() => useSpeechVoices());

    await waitFor(() => {
      expect(synth.addEventListener).toHaveBeenCalledWith("voiceschanged", expect.any(Function));
    });

    synth.getVoices.mockReturnValue([
      { name: "Late", lang: "en-US", voiceURI: "late://1", localService: false, default: false },
    ]);
    onVoicesChanged?.();
    await waitFor(() => {
      expect(synth.getVoices).toHaveBeenCalled();
    });
  });

  it("reload re-reads the voice list", async () => {
    const synth = window.speechSynthesis as any;
    synth.getVoices.mockReturnValue([]);

    const { result } = renderHook(() => useSpeechVoices());
    const callsBefore = synth.getVoices.mock.calls.length;

    synth.getVoices.mockReturnValue([
      { name: "C", lang: "en-US", voiceURI: "c://3", localService: false, default: false },
    ]);
    result.current.reload();

    await waitFor(() => {
      expect(synth.getVoices.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
