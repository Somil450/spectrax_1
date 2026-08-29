import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface MockBatteryManager {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  _listeners: Record<string, (() => void)[]>;
  addEventListener: (type: string, cb: () => void) => void;
  _emit: (type: string) => void;
}

function makeBatteryManager(
  overrides: Partial<Omit<MockBatteryManager, "_listeners" | "addEventListener" | "_emit">> = {},
): MockBatteryManager {
  const listeners: Record<string, (() => void)[]> = {};
  return {
    level: 1,
    charging: true,
    chargingTime: Infinity,
    dischargingTime: Infinity,
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

function stubBattery(manager: MockBatteryManager | null) {
  if (manager === null) {
    Object.defineProperty(navigator, "getBattery", {
      value: undefined,
      configurable: true,
    });
    return;
  }
  Object.defineProperty(navigator, "getBattery", {
    value: async () => manager,
    configurable: true,
  });
}

function restoreBatteryStub() {
  delete (navigator as any).getBattery;
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  restoreBatteryStub();
  vi.unstubAllGlobals();
});

describe("BatteryDownscaler.getResolutionScale", () => {
  it("keeps full resolution when the Battery API is unavailable", async () => {
    stubBattery(null);
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();
    expect(batteryDownscaler.getResolutionScale()).toBe(1.0);
  });

  it("keeps full resolution while charging even at a low level", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: true });
    stubBattery(manager);
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();
    expect(batteryDownscaler.getResolutionScale()).toBe(1.0);
  });

  it("downscales to 0.75 when discharging at moderate level", async () => {
    const manager = makeBatteryManager({ level: 0.3, charging: false });
    stubBattery(manager);
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();
    expect(batteryDownscaler.getResolutionScale()).toBe(0.75);
  });

  it("downscales to 0.5 when discharging at a critically low level", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: false });
    stubBattery(manager);
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();
    expect(batteryDownscaler.getResolutionScale()).toBe(0.5);
  });
});

describe("BatteryDownscaler reactivity", () => {
  it("notifies subscribers immediately and on levelchange events", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: false });
    stubBattery(manager);
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();

    const seen: number[] = [];
    batteryDownscaler.subscribe(() => {
      seen.push(batteryDownscaler.getResolutionScale());
    });

    expect(seen).toEqual([0.5]);

    manager.level = 0.9;
    manager.charging = true;
    manager._emit("levelchange");
    manager._emit("chargingchange");

    expect(seen).toEqual([0.5, 1.0, 1.0]);
  });

  it("stops notifying after unsubscribe", async () => {
    const manager = makeBatteryManager({ level: 0.1, charging: false });
    stubBattery(manager);
    const { batteryDownscaler } = await import("./batteryDownscaler");
    await batteryDownscaler.init();

    let count = 0;
    const unsubscribe = batteryDownscaler.subscribe(() => {
      count++;
    });
    expect(count).toBe(1);

    unsubscribe();
    manager._emit("levelchange");
    expect(count).toBe(1);
  });
});
