/**
 * batteryDownscaler.ts
 * Battery-status based frame downsizer (see issue #190).
 *
 * When the device is running on battery at a low charge level, downstream
 * processing (pose workers, MediaPipe, overlay rendering) gets lower-resolution
 * frames so smooth processing keeps working even under power-saving settings.
 */

export interface BatteryState {
  /** Charge level in the range 0..1. */
  level: number;
  /** Whether the battery is currently charging. */
  charging: boolean;
  /** Seconds remaining until full (Infinity when unknown). */
  chargingTime: number;
  /** Seconds remaining until empty (Infinity when unknown). */
  dischargingTime: number;
}

const DEFAULT_STATE: BatteryState = {
  level: 1,
  charging: true,
  chargingTime: Infinity,
  dischargingTime: Infinity,
};

export interface BatteryManagerLike {
  level: number;
  charging: boolean;
  chargingTime: number;
  dischargingTime: number;
  addEventListener?: (type: string, listener: () => void) => void;
}

type BatteryListener = (state: BatteryState) => void;

export class BatteryDownscaler {
  private state: BatteryState = DEFAULT_STATE;
  private listeners: Set<BatteryListener> = new Set();
  private batteryManager: BatteryManagerLike | null = null;
  private initialized = false;

  /**
   * Requests the Battery Status API and starts watching level/charging
   * changes. Safe to call repeatedly; unavailable APIs are ignored.
   */
  async init(): Promise<void> {
    if (this.initialized) return;

    const nav = navigator as Navigator & {
      getBattery?: () => Promise<BatteryManagerLike>;
    };
    if (!nav.getBattery) {
      this.initialized = true;
      return;
    }

    try {
      this.batteryManager = await nav.getBattery();
      this.updateState(this.batteryManager);
      this.batteryManager.addEventListener?.("levelchange", () => {
        if (this.batteryManager) this.updateState(this.batteryManager);
      });
      this.batteryManager.addEventListener?.("chargingchange", () => {
        if (this.batteryManager) this.updateState(this.batteryManager);
      });
    } catch {
      // Battery Status API is a best-effort enhancement; ignore failures.
    } finally {
      this.initialized = true;
    }
  }

  /** Returns the current battery state. */
  getState(): BatteryState {
    return this.state;
  }

  /**
   * Subscribes to battery state changes. Invoked immediately with the current
   * state. Returns an unsubscribe function.
   */
  subscribe(listener: BatteryListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Resolution scale factor (1.0 = full resolution) derived from battery
   * status. Frames are downscaled before being sent to pose workers when the
   * device is discharging at a low charge level.
   */
  getResolutionScale(): number {
    const { level, charging } = this.state;
    if (charging || level > 0.5) return 1.0;
    if (level > 0.25) return 0.75;
    return 0.5;
  }

  private updateState(manager: BatteryManagerLike): void {
    this.state = {
      level: typeof manager.level === "number" ? manager.level : 1,
      charging: !!manager.charging,
      chargingTime:
        typeof manager.chargingTime === "number"
          ? manager.chargingTime
          : Infinity,
      dischargingTime:
        typeof manager.dischargingTime === "number"
          ? manager.dischargingTime
          : Infinity,
    };
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export const batteryDownscaler = new BatteryDownscaler();
