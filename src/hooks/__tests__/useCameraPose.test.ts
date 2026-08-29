import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCameraPose, CAMERA_INIT_TIMEOUT_MS } from "../useCameraPose";

vi.mock("../../services/cameraService", () => ({
  cameraService: {
    startCamera: vi.fn(),
    stopCamera: vi.fn(),
    onFrameComplete: vi.fn(),
    startFrameLoop: vi.fn(),
  },
}));

vi.mock("../../services/poseService", () => ({
  poseService: {
    setInterpolationEnabled: vi.fn(),
    onResults: vi.fn(),
    send: vi.fn(),
    setOptions: vi.fn(),
  },
}));

vi.mock("../../services/overlayRenderer", () => ({
  overlayRenderer: {
    setContext: vi.fn(),
  },
}));

vi.mock("../../services/depthEstimationEngine", () => ({
  depthEstimationEngine: {
    init: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock("../../services/performanceThrottleService", () => ({
  throttleMonitor: {
    start: vi.fn(),
    getCurrentLevel: vi.fn(() => 0),
    onLevelChange: vi.fn(() => () => {}),
  },
}));

import { cameraService } from "../../services/cameraService";
import { depthEstimationEngine } from "../../services/depthEstimationEngine";

describe("useCameraPose", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(depthEstimationEngine.init).mockResolvedValue(undefined);
    vi.mocked(cameraService.startCamera).mockReset();
    vi.mocked(cameraService.stopCamera).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("reports CAMERA_TIMEOUT when initialization exceeds the timeout", async () => {
    vi.mocked(cameraService.startCamera).mockImplementation(
      () => new Promise(() => {}),
    );
    const onCameraError = vi.fn();
    const videoRef = { current: document.createElement("video") };
    const canvasRef = { current: document.createElement("canvas") };

    const { result } = renderHook(() =>
      useCameraPose({
        videoRef,
        canvasRef,
        onResults: vi.fn(),
        onCameraError,
        initTimeoutMs: 500,
      }),
    );

    await act(async () => {
      result.current.startSystem();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(onCameraError).toHaveBeenCalledTimes(1);
    const err = onCameraError.mock.calls[0][0] as Error;
    expect(err.message).toBe("CAMERA_TIMEOUT");
    expect(cameraService.stopCamera).toHaveBeenCalled();
  });

  it("does not report a timeout when initialization completes in time", async () => {
    vi.mocked(cameraService.startCamera).mockResolvedValue(
      {} as unknown as MediaStream,
    );
    const onCameraError = vi.fn();
    const videoRef = { current: document.createElement("video") };
    const canvasRef = { current: document.createElement("canvas") };

    const { result } = renderHook(() =>
      useCameraPose({
        videoRef,
        canvasRef,
        onResults: vi.fn(),
        onCameraError,
        initTimeoutMs: 1000,
      }),
    );

    await act(async () => {
      result.current.startSystem();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(onCameraError).not.toHaveBeenCalled();
    expect(cameraService.startFrameLoop).toHaveBeenCalled();
  });

  it("uses the default init timeout when none is provided", () => {
    expect(CAMERA_INIT_TIMEOUT_MS).toBe(20000);
  });
});
