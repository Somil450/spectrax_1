/**
 * depthWorker.ts
 * Web Worker for monocular depth estimation.
 * Loads Depth-Anything/MiDaS via @xenova/transformers pipeline API.
 * Falls back to CPU if WebGPU compute is unavailable.
 */

import { pipeline, RawImage } from "@xenova/transformers";
import type { DepthEstimationConfig, DepthMapResult } from "../types/pose";

let depthPipeline: any = null;
let config: DepthEstimationConfig | null = null;

let depthBuffer: Float32Array | null = null;
let depthWidth = 0;
let depthHeight = 0;

let gpuDevice: GPUDevice | null = null;
let gpuPipeline: GPUComputePipeline | null = null;
let gpuBindGroupLayout: GPUBindGroupLayout | null = null;
let gpuUniformBuffer: GPUBuffer | null = null;
let gpuInputBuffer: GPUBuffer | null = null;
let gpuOutputBuffer: GPUBuffer | null = null;
let gpuStagingBuffer: GPUBuffer | null = null;
let gpuWorkgroupSize = 8;

async function initWebGPUCompute(): Promise<boolean> {
  if (gpuDevice) return true;
  if (typeof navigator === "undefined" || !("gpu" in navigator)) return false;

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return false;

    gpuDevice = await adapter.requestDevice();

    const shaderCode = `
      @group(0) @binding(0) var<storage, read> inputDepth: array<f32>;
      @group(0) @binding(1) var<storage, read_write> outputDepth: array<f32>;
      @group(0) @binding(2) var<uniform> params: vec4<f32>;

      @compute @workgroup_size(8, 8, 1)
      fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
        let width = u32(params.x);
        let height = u32(params.y);
        let minD = params.z;
        let maxD = params.w;

        let x = gid.x;
        let y = gid.y;
        if (x >= width || y >= height) { return; }

        let idx = y * width + x;
        var sum = 0.0;
        var count = 0.0;

        for (var dy: i32 = -1; dy <= 1; dy = dy + 1) {
          for (var dx: i32 = -1; dx <= 1; dx = dx + 1) {
            let sx = i32(x) + dx;
            let sy = i32(y) + dy;
            if (sx >= 0 && sx < i32(width) && sy >= 0 && sy < i32(height)) {
              let sidx = u32(sy) * width + u32(sx);
              sum = sum + clamp(inputDepth[sidx], minD, maxD);
              count = count + 1.0;
            }
          }
        }

        outputDepth[idx] = sum / count;
      }
    `;

    const shaderModule = gpuDevice.createShaderModule({ code: shaderCode });

    gpuBindGroupLayout = gpuDevice.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      ],
    });

    gpuPipeline = gpuDevice.createComputePipeline({
      layout: gpuDevice.createPipelineLayout({ bindGroupLayouts: [gpuBindGroupLayout] }),
      compute: { module: shaderModule, entryPoint: "main" },
    });

    return true;
  } catch {
    return false;
  }
}

async function runWebGPUPreprocess(
  input: Float32Array,
  width: number,
  height: number,
  minD: number,
  maxD: number
): Promise<Float32Array> {
  if (!gpuDevice || !gpuPipeline || !gpuBindGroupLayout) {
    throw new Error("WebGPU not initialized");
  }

  const byteSize = input.byteLength;

  if (!gpuInputBuffer || gpuInputBuffer.size < byteSize) {
    gpuInputBuffer?.destroy();
    gpuOutputBuffer?.destroy();
    gpuStagingBuffer?.destroy();
    gpuUniformBuffer?.destroy();

    gpuInputBuffer = gpuDevice.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    gpuOutputBuffer = gpuDevice.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    });
    gpuStagingBuffer = gpuDevice.createBuffer({
      size: byteSize,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    gpuUniformBuffer = gpuDevice.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  gpuDevice.queue.writeBuffer(gpuInputBuffer, 0, input);
  gpuDevice.queue.writeBuffer(
    gpuUniformBuffer,
    0,
    new Float32Array([width, height, minD, maxD])
  );

  const bindGroup = gpuDevice.createBindGroup({
    layout: gpuBindGroupLayout,
    entries: [
      { binding: 0, resource: { buffer: gpuInputBuffer } },
      { binding: 1, resource: { buffer: gpuOutputBuffer } },
      { binding: 2, resource: { buffer: gpuUniformBuffer } },
    ],
  });

  const commandEncoder = gpuDevice.createCommandEncoder();
  const passEncoder = commandEncoder.beginComputePass();
  passEncoder.setPipeline(gpuPipeline);
  passEncoder.setBindGroup(0, bindGroup);
  passEncoder.dispatchWorkgroups(
    Math.ceil(width / gpuWorkgroupSize),
    Math.ceil(height / gpuWorkgroupSize),
    1
  );
  passEncoder.end();

  commandEncoder.copyBufferToBuffer(gpuOutputBuffer, 0, gpuStagingBuffer, 0, byteSize);
  gpuDevice.queue.submit([commandEncoder.finish()]);

  await gpuStagingBuffer.mapAsync(GPUMapMode.READ);
  const result = new Float32Array(gpuStagingBuffer.getMappedRange().slice(0));
  gpuStagingBuffer.unmap();

  return result;
}

function smoothDepthMap(
  buffer: Float32Array,
  width: number,
  height: number,
  sigma: number
): void {
  const radius = Math.max(1, Math.round(sigma));
  const temp = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(Math.max(x + k, 0), width - 1);
        const idx = y * width + sx;
        sum += buffer[idx];
        count++;
      }
      temp[y * width + x] = sum / count;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(Math.max(y + k, 0), height - 1);
        const idx = sy * width + x;
        sum += temp[idx];
        count++;
      }
      buffer[y * width + x] = sum / count;
    }
  }
}

self.onmessage = async (event: MessageEvent) => {
  const { type } = event.data;

  if (type === "init") {
    config = event.data.config as DepthEstimationConfig;
    try {
      depthPipeline = await pipeline("depth-estimation", config.modelName, {
        dtype: "fp16",
      });
      (self as any).postMessage({ type: "ready" });
    } catch (err: any) {
      (self as any).postMessage({
        type: "error",
        error: `Failed to load depth model: ${err.message}`,
      });
    }
    return;
  }

  if (type === "infer") {
    if (!depthPipeline || !config) {
      (self as any).postMessage({
        type: "error",
        error: "Depth pipeline not initialized",
      });
      return;
    }

    const { bitmap, frameId } = event.data as {
      bitmap: ImageBitmap;
      frameId: number;
    };

    try {
      const rawImage = new RawImage(
        new Uint8ClampedArray(bitmap.width * bitmap.height * 4),
        bitmap.width,
        bitmap.height,
        4
      );

      const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = offscreen.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      rawImage.data.set(imageData.data);

      const result = await depthPipeline(rawImage);
      const depthData = result.depth.data as Float32Array;
      const [h, w] = result.depth.dims as [number, number];

      if (w !== depthWidth || h !== depthHeight) {
        depthWidth = w;
        depthHeight = h;
        depthBuffer = new Float32Array(w * h);
      }

      const minD = config.minDepthMeters;
      const maxD = config.maxDepthMeters;
      for (let i = 0; i < depthData.length; i++) {
        let v = depthData[i];
        v = 1.0 / Math.max(v, 0.001);
        depthBuffer![i] = Math.max(minD, Math.min(maxD, v));
      }

      let processedDepth: Float32Array;
      const webgpuReady = await initWebGPUCompute();
      if (webgpuReady && config.bilateralFilterSigma > 0) {
        try {
          processedDepth = await runWebGPUPreprocess(
            depthBuffer!,
            w,
            h,
            minD,
            maxD
          );
        } catch {
          smoothDepthMap(depthBuffer!, w, h, config.bilateralFilterSigma);
          processedDepth = depthBuffer!.slice();
        }
      } else if (config.bilateralFilterSigma > 0) {
        smoothDepthMap(depthBuffer!, w, h, config.bilateralFilterSigma);
        processedDepth = depthBuffer!.slice();
      } else {
        processedDepth = depthBuffer!.slice();
      }

      const depthResult: DepthMapResult = {
        width: w,
        height: h,
        data: processedDepth,
        timestamp: performance.now(),
      };

      (self as any).postMessage({
        type: "depthResult",
        result: depthResult,
        frameId,
      });
    } catch (err: any) {
      (self as any).postMessage({
        type: "error",
        error: `Depth inference failed: ${err.message}`,
      });
    }
    return;
  }
};