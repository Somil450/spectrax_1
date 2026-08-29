import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCameraPermissionState,
  watchCameraPermission,
  watchCameraGranted,
} from "../cameraPermissionService";

describe("cameraPermissionService", () => {
  const originalPermissions = navigator.permissions;

  const mockStatus = (state: string) => {
    const status = {
      state,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    return status;
  };

  const setQueryMock = (impl: any) => {
    Object.defineProperty(navigator, "permissions", {
      value: { query: impl },
      configurable: true,
    });
  };

  afterEach(() => {
    Object.defineProperty(navigator, "permissions", {
      value: originalPermissions,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("returns granted state from the Permissions API", async () => {
    setQueryMock(vi.fn().mockResolvedValue(mockStatus("granted")));
    expect(await getCameraPermissionState()).toBe("granted");
  });

  it("returns denied state from the Permissions API", async () => {
    setQueryMock(vi.fn().mockResolvedValue(mockStatus("denied")));
    expect(await getCameraPermissionState()).toBe("denied");
  });

  it("falls back to unknown when the Permissions API is missing", async () => {
    Object.defineProperty(navigator, "permissions", {
      value: undefined,
      configurable: true,
    });
    expect(await getCameraPermissionState()).toBe("unknown");
  });

  it("falls back to unknown when the camera query is unsupported", async () => {
    setQueryMock(vi.fn().mockRejectedValue(new TypeError("Camera permission is not supported")));
    expect(await getCameraPermissionState()).toBe("unknown");
  });

  it("watchCameraPermission reports subsequent changes and stops cleanly", async () => {
    const status = mockStatus("prompt");
    const listenerSet = new Set<() => void>();
    status.addEventListener.mockImplementation((_: string, fn: () => void) =>
      listenerSet.add(fn)
    );
    status.removeEventListener.mockImplementation((_: string, fn: () => void) =>
      listenerSet.delete(fn)
    );
    setQueryMock(vi.fn().mockResolvedValue(status));

    const onChange = vi.fn();
    const watcher = watchCameraPermission(onChange);

    await vi.waitFor(() => {
      expect(status.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    });

    status.state = "granted";
    listenerSet.forEach((fn) => fn());
    expect(onChange).toHaveBeenCalledWith("granted");

    watcher.stop();
    expect(status.removeEventListener).toHaveBeenCalled();
  });

  it("watchCameraPermission is a no-op without the Permissions API", () => {
    Object.defineProperty(navigator, "permissions", {
      value: undefined,
      configurable: true,
    });
    const watcher = watchCameraPermission(vi.fn());
    expect(watcher.stop).toBeDefined();
    expect(() => watcher.stop()).not.toThrow();
  });

  it("watchCameraGranted fires only on the granted transition", async () => {
    const status = mockStatus("denied");
    const listenerSet = new Set<() => void>();
    status.addEventListener.mockImplementation((_: string, fn: () => void) =>
      listenerSet.add(fn)
    );
    setQueryMock(vi.fn().mockResolvedValue(status));

    const onGranted = vi.fn();
    const watcher = watchCameraGranted(onGranted);

    await vi.waitFor(() => {
      expect(status.addEventListener).toHaveBeenCalled();
    });

    status.state = "prompt";
    listenerSet.forEach((fn) => fn());
    expect(onGranted).not.toHaveBeenCalled();

    status.state = "granted";
    listenerSet.forEach((fn) => fn());
    expect(onGranted).toHaveBeenCalledTimes(1);

    watcher.stop();
  });
});
