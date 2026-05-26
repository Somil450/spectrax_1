import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useNetworkStatus } from "../useNetworkStatus";

describe("useNetworkStatus", () => {
  let listeners: Record<string, EventListener[]>;

  beforeEach(() => {
    listeners = { online: [], offline: [] };

    vi.spyOn(window, "addEventListener").mockImplementation(
      (event: string, handler: EventListener) => {
        if (listeners[event]) {
          listeners[event].push(handler);
        }
      },
    );

    vi.spyOn(window, "removeEventListener").mockImplementation(
      (event: string, handler: EventListener) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((h) => h !== handler);
        }
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when navigator.onLine is true", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(true);
  });

  it("returns false when navigator.onLine is false", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());
    expect(result.current.isOnline).toBe(false);
  });

  it("updates to false on offline event", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      listeners.offline.forEach((handler) =>
        handler(new Event("offline")),
      );
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("updates to true on online event", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useNetworkStatus());

    act(() => {
      listeners.online.forEach((handler) =>
        handler(new Event("online")),
      );
    });

    expect(result.current.isOnline).toBe(true);
  });

  it("calls onReconnect callback when going online", () => {
    Object.defineProperty(navigator, "onLine", {
      value: false,
      writable: true,
      configurable: true,
    });

    const onReconnect = vi.fn();
    renderHook(() => useNetworkStatus(onReconnect));

    act(() => {
      listeners.online.forEach((handler) =>
        handler(new Event("online")),
      );
    });

    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it("does not call onReconnect on offline event", () => {
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });

    const onReconnect = vi.fn();
    renderHook(() => useNetworkStatus(onReconnect));

    act(() => {
      listeners.offline.forEach((handler) =>
        handler(new Event("offline")),
      );
    });

    expect(onReconnect).not.toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", () => {
    const { unmount } = renderHook(() => useNetworkStatus());
    unmount();

    expect(listeners.online).toHaveLength(0);
    expect(listeners.offline).toHaveLength(0);
  });
});
