import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkoutWebSocket } from "../useWorkoutWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closeCalls = 0;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  close() {
    this.closeCalls++;
    this.onclose?.();
  }
}

const RECONNECT_DELAY_MS = 2000;

describe("useWorkoutWebSocket", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("starts connected and stays connected while open", () => {
    const { result } = renderHook(() => useWorkoutWebSocket("http://localhost:3001"));
    expect(result.current.isConnected).toBe(true);

    act(() => {
      MockWebSocket.instances[0].onopen?.();
    });
    expect(result.current.isConnected).toBe(true);
  });

  it("reports disconnected when the socket closes", () => {
    const { result } = renderHook(() => useWorkoutWebSocket("http://localhost:3001"));

    act(() => {
      MockWebSocket.instances[0].onclose?.();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("reports disconnected when the socket errors", () => {
    const { result } = renderHook(() => useWorkoutWebSocket("http://localhost:3001"));

    act(() => {
      MockWebSocket.instances[0].onerror?.();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it("auto-reconnects after the socket closes", async () => {
    const { result } = renderHook(() => useWorkoutWebSocket("http://localhost:3001"));
    expect(MockWebSocket.instances).toHaveLength(1);

    act(() => {
      MockWebSocket.instances[0].onclose?.();
    });
    expect(result.current.isConnected).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_MS + 1);
    });
    expect(MockWebSocket.instances).toHaveLength(2);

    act(() => {
      MockWebSocket.instances[1].onopen?.();
    });
    expect(result.current.isConnected).toBe(true);
  });
});
