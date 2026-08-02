import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockBatteryManager {
  level: number;
  charging: boolean;
  _listeners: Record<string, (() => void)[]>;
  addEventListener: (type: string, cb: () => void) => void;
  _emit: (type: string) => void;
}

function makeBatteryManager(
  overrides: Partial<Pick<MockBatteryManager, "level" | "charging">> = {},
): MockBatteryManager {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    level: 1,
    charging: true,
    _listeners: listeners,
    addEventListener(type: string, cb: () => void) {
      (listeners[type] ??= []).push(cb);
    },
    _emit(type: string) {
      (listeners[type] ?? []).forEach((cb) => cb());
    },
    ...overrides,
  };
}

function stubBattery(manager: MockBatteryManager) {
  Object.defineProperty(navigator, "getBattery", {
    value: async () => manager,
    configurable: true,
  });
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  delete (navigator as any).getBattery;
});

describe("cameraService battery-aware downscaling (issue #190)", () => {
  it("applies the battery scale when the frame loop starts on low battery", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: false });
    stubBattery(manager);

    const { cameraService } = await import("./cameraService");
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();

    cameraService.startFrameLoop(() => {}, 20, 10, 5);

    expect((cameraService as any).batteryScale).toBe(0.5);

    cameraService.stopFrameLoop();
  });

  it("tracks battery changes while the loop is running", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: false });
    stubBattery(manager);

    const { cameraService } = await import("./cameraService");
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();

    cameraService.startFrameLoop(() => {}, 20, 10, 5);
    expect((cameraService as any).batteryScale).toBe(0.5);

    manager.level = 0.9;
    manager.charging = true;
    manager._emit("levelchange");
    expect((cameraService as any).batteryScale).toBe(1.0);

    cameraService.stopFrameLoop();
  });

  it("resets and unsubscribes on stopFrameLoop", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: false });
    stubBattery(manager);

    const { cameraService } = await import("./cameraService");
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();

    cameraService.startFrameLoop(() => {}, 20, 10, 5);
    expect((cameraService as any).batteryScale).toBe(0.5);

    cameraService.stopFrameLoop();
    expect((cameraService as any).batteryScale).toBe(1.0);

    manager.level = 0.1;
    manager.charging = false;
    manager._emit("levelchange");
    expect((cameraService as any).batteryScale).toBe(1.0);
  });
});
