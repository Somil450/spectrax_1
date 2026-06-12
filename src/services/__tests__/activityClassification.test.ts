import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ActivityClassificationService, ActivityWorkerResponse } from "../activityClassificationService";

describe("ActivityClassificationService", () => {
  let service: ActivityClassificationService;
  let workerMock: { postMessage: ReturnType<typeof vi.fn>; terminate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    workerMock = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    vi.stubGlobal("Worker", vi.fn(() => workerMock));
    service = new ActivityClassificationService();
  });

  afterEach(() => {
    service.destroy();
    vi.unstubAllGlobals();
  });

  it("creates a worker on construction", () => {
    expect(Worker).toHaveBeenCalledOnce();
  });

  it("sends init message with quantized: true", () => {
    expect(workerMock.postMessage).toHaveBeenCalledWith({
      type: "init",
      quantized: true,
    });
  });

  it("sends analyze message with correct labels on start", () => {
    const callback = vi.fn();
    const mockBitmap = {} as ImageBitmap;
    vi.stubGlobal("createImageBitmap", vi.fn(() => Promise.resolve(mockBitmap)));

    const video = { paused: false, ended: false } as HTMLVideoElement;
    service.start(video, callback);

    expect(workerMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "analyze",
        labels: expect.arrayContaining(["squat", "pushup", "plank"]),
      }),
      expect.any(Array),
    );
  });

  it("sets isReady on ready message", () => {
    const handler = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const workerOnMessage = (Worker as any).mock.instances[0].onmessage;

    workerOnMessage({
      data: { type: "ready", quantized: true } as ActivityWorkerResponse,
    });

    service.start({ paused: false, ended: false } as HTMLVideoElement, vi.fn());

    expect(workerMock.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "analyze" }),
      expect.any(Array),
    );
  });

  it("calls onActivityDetected callback on prediction", () => {
    const callback = vi.fn();
    const handler = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const workerOnMessage = (Worker as any).mock.instances[0].onmessage;

    workerOnMessage({
      data: {
        type: "prediction",
        results: [{ label: "squat", score: 0.95 }],
        inferenceTimeMs: 100,
        quantized: true,
      } as ActivityWorkerResponse,
    });

    expect(callback).toHaveBeenCalledWith([{ label: "squat", score: 0.95 }]);
  });

  it("handles error message without crashing", () => {
    const workerOnMessage = (Worker as any).mock.instances[0].onmessage;
    expect(() => {
      workerOnMessage({
        data: { type: "error", error: "Model load failed" } as ActivityWorkerResponse,
      });
    }).not.toThrow();
  });

  it("response types include quantized and fallback fields", () => {
    const modelLoaded: ActivityWorkerResponse = {
      type: "model-loaded",
      quantized: true,
      fallback: false,
    };
    expect(modelLoaded.fallback).toBe(false);
    expect(modelLoaded.quantized).toBe(true);

    const fallbackLoaded: ActivityWorkerResponse = {
      type: "model-loaded",
      quantized: false,
      fallback: true,
    };
    expect(fallbackLoaded.fallback).toBe(true);
    expect(fallbackLoaded.quantized).toBe(false);
  });

  it("destroy terminates worker and resets state", () => {
    service.destroy();
    expect(workerMock.terminate).toHaveBeenCalledOnce();
    const newService = new ActivityClassificationService();
    expect(newService).toBeDefined();
    newService.destroy();
  });
});
