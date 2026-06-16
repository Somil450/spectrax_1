/**
 * webgpuSupport.ts
 * Detects WebGPU availability and reports adapter limits.
 * All detection is lazy — no work done until first call.
 */

export interface WebGPUCapabilities {
  available: boolean;
  adapter: GPUAdapter | null;
  device: GPUDevice | null;
  maxComputeWorkgroupSize: number;
  maxBufferSize: number;
  supportsComputeShaders: boolean;
}

let cachedCaps: WebGPUCapabilities | null = null;

export async function getWebGPUCapabilities(): Promise<WebGPUCapabilities> {
  if (cachedCaps) return cachedCaps;

  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    cachedCaps = {
      available: false,
      adapter: null,
      device: null,
      maxComputeWorkgroupSize: 0,
      maxBufferSize: 0,
      supportsComputeShaders: false,
    };
    return cachedCaps;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: "high-performance",
    });

    if (!adapter) {
      cachedCaps = {
        available: false,
        adapter: null,
        device: null,
        maxComputeWorkgroupSize: 0,
        maxBufferSize: 0,
        supportsComputeShaders: false,
      };
      return cachedCaps;
    }

    const device = await adapter.requestDevice();

    cachedCaps = {
      available: true,
      adapter,
      device,
      maxComputeWorkgroupSize: adapter.limits.maxComputeWorkgroupSizeX,
      maxBufferSize: adapter.limits.maxBufferSize,
      supportsComputeShaders: true,
    };

    return cachedCaps;
  } catch {
    cachedCaps = {
      available: false,
      adapter: null,
      device: null,
      maxComputeWorkgroupSize: 0,
      maxBufferSize: 0,
      supportsComputeShaders: false,
    };
    return cachedCaps;
  }
}

export function isWebGPUAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export function resetWebGPUCache(): void {
  cachedCaps = null;
}