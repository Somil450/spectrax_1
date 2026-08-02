import { describe, it, expect, afterEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCameraPermission } from "../useCameraPermission";

describe("useCameraPermission", () => {
  const originalPermissions = navigator.permissions;

  const makeStatus = (state: string) => {
    const handlers = new Set<() => void>();
    return {
      state,
      addEventListener: (_: string, fn: () => void) => handlers.add(fn),
      removeEventListener: (_: string, fn: () => void) => handlers.delete(fn),
      _fire: () => handlers.forEach((fn) => fn()),
    };
  };

  afterEach(() => {
    Object.defineProperty(navigator, "permissions", {
      value: originalPermissions,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it("surfaces a denied permission state", async () => {
    const status = makeStatus("denied");
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue(status) },
      configurable: true,
    });

    const { result } = renderHook(() => useCameraPermission());
    await waitFor(() => expect(result.current.isDenied).toBe(true));
    expect(result.current.state).toBe("denied");
    expect(result.current.isGranted).toBe(false);
  });

  it("fires onGranted when permission is granted on mount", async () => {
    const status = makeStatus("granted");
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue(status) },
      configurable: true,
    });

    const onGranted = vi.fn();
    renderHook(() => useCameraPermission({ onGranted }));
    await waitFor(() => expect(onGranted).toHaveBeenCalledTimes(1));
  });

  it("fires onDenied when permission becomes denied via change event", async () => {
    const status = makeStatus("prompt");
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue(status) },
      configurable: true,
    });

    const onDenied = vi.fn();
    const { result } = renderHook(() => useCameraPermission({ onDenied }));

    await waitFor(() => expect(result.current.state).toBe("prompt"));

    status.state = "denied";
    status._fire();

    await waitFor(() => expect(result.current.isDenied).toBe(true));
    expect(onDenied).toHaveBeenCalledTimes(1);
  });

  it("auto-recovers and fires onGranted when permission is re-granted", async () => {
    const status = makeStatus("denied");
    Object.defineProperty(navigator, "permissions", {
      value: { query: vi.fn().mockResolvedValue(status) },
      configurable: true,
    });

    const onGranted = vi.fn();
    const { result } = renderHook(() => useCameraPermission({ onGranted }));

    await waitFor(() => expect(result.current.isDenied).toBe(true));

    status.state = "granted";
    status._fire();

    await waitFor(() => expect(result.current.isGranted).toBe(true));
    expect(onGranted).toHaveBeenCalledTimes(1);
  });

  it("recheck re-queries the Permissions API", async () => {
    const status = makeStatus("prompt");
    const queryMock = vi.fn().mockResolvedValue(status);
    Object.defineProperty(navigator, "permissions", {
      value: { query: queryMock },
      configurable: true,
    });

    const { result } = renderHook(() => useCameraPermission());
    await waitFor(() => expect(result.current.state).toBe("prompt"));

    status.state = "granted";
    const callsBeforeRecheck = queryMock.mock.calls.length;
    await result.current.recheck();

    expect(queryMock).toHaveBeenCalledTimes(callsBeforeRecheck + 1);
    await waitFor(() => expect(result.current.isGranted).toBe(true));
  });
});
