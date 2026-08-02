import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildShareText, shareSessionCard, captureNodeAsPng } from "../shareSession";

vi.mock("html-to-image", () => ({
  toPng: vi.fn(async () => "data:image/png;base64,FAKE"),
}));

const payload = {
  exerciseType: "squat",
  totalReps: 30,
  accuracyScore: 92,
  duration: 300,
  timestamp: new Date(2026, 0, 15, 10, 30).getTime(),
};

describe("buildShareText", () => {
  it("includes exercise, reps, accuracy, duration, and date", () => {
    const text = buildShareText(payload);
    expect(text).toContain("SQUAT");
    expect(text).toContain("30 reps");
    expect(text).toContain("92% accuracy");
    expect(text).toContain("5m 0s");
    expect(text).toMatch(/Jan/i);
    expect(text).toMatch(/2026/);
  });
});

describe("captureNodeAsPng", () => {
  it("returns a data URL on success", async () => {
    const node = { offsetWidth: 100, offsetHeight: 50 } as HTMLElement;
    const dataUrl = await captureNodeAsPng(node);
    expect(typeof dataUrl).toBe("string");
    expect(dataUrl!.startsWith("data:image/png")).toBe(true);
  });
});

describe("shareSessionCard", () => {
  const originalShare = navigator.share;
  const originalClipboard = navigator.clipboard;
  const originalCanShare = navigator.canShare;

  beforeEach(() => {
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "share", { value: originalShare, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: originalCanShare, configurable: true });
    vi.restoreAllMocks();
  });

  it("uses the native share API when available", async () => {
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });
    Object.defineProperty(navigator, "canShare", { value: vi.fn().mockReturnValue(true), configurable: true });

    const node = { offsetWidth: 100, offsetHeight: 50 } as HTMLElement;
    const result = await shareSessionCard(node, payload);
    expect(result.method).toBe("share");
    expect(shareMock).toHaveBeenCalled();
  });

  it("falls back to a PNG download when the share API is unavailable", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const node = { offsetWidth: 100, offsetHeight: 50 } as HTMLElement;
    const result = await shareSessionCard(node, payload);
    expect(result.success).toBe(true);
    expect(result.method).toBe("download");
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("reports cancellation of the native share sheet", async () => {
    const shareMock = vi.fn().mockRejectedValue(Object.assign(new Error("aborted"), { name: "AbortError" }));
    Object.defineProperty(navigator, "share", { value: shareMock, configurable: true });

    const node = { offsetWidth: 100, offsetHeight: 50 } as HTMLElement;
    const result = await shareSessionCard(node, payload);
    expect(result.success).toBe(false);
    expect(result.error).toBe("cancelled");
  });
});
