
/**
 * gpuAngleUtils.ts
 * WebGPU-accelerated bone angle calculator.
 * Falls back to CPU (angleUtils) if WebGPU is unavailable.
 */

import { getJointAngles } from './angleUtils';

// WGSL compute shader — runs entirely on GPU
// Each landmark is packed as vec4<f32>: x, y, z, visibility
// Computes angles for: knee, elbow, shoulder, bodyLine
const WGSL_SHADER = /* wgsl */`
struct Landmark {
  x: f32,
  y: f32,
  z: f32,
  vis: f32,
}

@group(0) @binding(0) var<storage, read>       landmarks : array<Landmark, 33>;
@group(0) @binding(1) var<storage, read_write>  angles    : array<f32, 9>;

fn angle3(a: Landmark, b: Landmark, c: Landmark) -> f32 {
  let radians = atan2(c.y - b.y, c.x - b.x) - atan2(a.y - b.y, a.x - b.x);
  var deg = abs(radians * 180.0 / 3.14159265358979);
  if (deg > 180.0) { deg = 360.0 - deg; }
  return deg;
}

@compute @workgroup_size(1)
fn main() {
  // Pick best visible side (left indices: 11,13,15,23,25,27 / right: 12,14,16,24,26,28)
  let leftVis  = (landmarks[11].vis + landmarks[13].vis + landmarks[15].vis +
                  landmarks[23].vis + landmarks[25].vis + landmarks[27].vis) / 6.0;
  let rightVis = (landmarks[12].vis + landmarks[14].vis + landmarks[16].vis +
                  landmarks[24].vis + landmarks[26].vis + landmarks[28].vis) / 6.0;

  var s: u32; var e: u32; var w: u32; var h: u32; var k: u32; var a: u32;
  if (leftVis >= rightVis) {
    s = 11u; e = 13u; w = 15u; h = 23u; k = 25u; a = 27u;
  } else {
    s = 12u; e = 14u; w = 16u; h = 24u; k = 26u; a = 28u;
  }

  // angles[0] = knee
  angles[0] = angle3(landmarks[h], landmarks[k], landmarks[a]);
  // angles[1] = elbow
  angles[1] = angle3(landmarks[s], landmarks[e], landmarks[w]);
  // angles[2] = shoulder
  angles[2] = angle3(landmarks[e], landmarks[s], landmarks[h]);
  // angles[3] = bodyLine
  angles[3] = angle3(landmarks[s], landmarks[h], landmarks[a]);

  // angles[4] = hipDepth * 100
  let totalH = abs(landmarks[a].y - landmarks[s].y);
  let safeH  = select(1.0, totalH, totalH > 0.0001);
  angles[4]  = ((landmarks[a].y - landmarks[h].y) / safeH) * 100.0;

  // angles[5] = lateralScore * 100
  let gap    = abs(landmarks[11].x - landmarks[12].x);
  angles[5]  = clamp((1.0 - gap * 5.0) * 100.0, 0.0, 100.0);

  // angles[6] = horizontalStretch * 100
  angles[6]  = abs(landmarks[a].x - landmarks[s].x) * 100.0;

  // angles[7] = average bilateral arm-opening angle for jumping jacks
  let leftArmOpen = angle3(landmarks[13], landmarks[11], landmarks[23]);
  let rightArmOpen = angle3(landmarks[14], landmarks[12], landmarks[24]);
  angles[7] = (leftArmOpen + rightArmOpen) / 2.0;

  // angles[8] = ankle spread normalized by hip width for jumping jacks
  let hipWidth = abs(landmarks[23].x - landmarks[24].x);
  let safeHipWidth = select(0.1, hipWidth, hipWidth > 0.0001);
  angles[8] = min(300.0, (abs(landmarks[27].x - landmarks[28].x) / safeHipWidth) * 100.0);
}
`;

// Output keys matching getJointAngles
const ANGLE_KEYS = [
  'knee', 'elbow', 'shoulder', 'bodyLine',
  'hipDepth', 'lateralScore', 'horizontalStretch',
  'jumpingJackArmOpen', 'jumpingJackLegSpread',
] as const;

const LM_COUNT  = 33;
const FLOATS_PER_LM = 4; // x, y, z, visibility
const LM_BUF_BYTES  = LM_COUNT * FLOATS_PER_LM * 4;
const ANGLE_COUNT   = 9;
const ANGLE_BUF_BYTES = ANGLE_COUNT * 4;

export class GpuAngleCalculator {
  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private landmarkBuf: GPUBuffer | null = null;
  private angleBuf: GPUBuffer | null = null;
  private readbackBuf: GPUBuffer | null = null;
  private bindGroup: GPUBindGroup | null = null;
  private ready = false;

  async init(): Promise<boolean> {
    if (!navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      this.device = await adapter.requestDevice();

      this.landmarkBuf = this.device.createBuffer({
        size: LM_BUF_BYTES,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
      });

      this.angleBuf = this.device.createBuffer({
        size: ANGLE_BUF_BYTES,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
      });

      this.readbackBuf = this.device.createBuffer({
        size: ANGLE_BUF_BYTES,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });

      const module = this.device.createShaderModule({ code: WGSL_SHADER });

      this.pipeline = this.device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });

      this.bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.landmarkBuf } },
          { binding: 1, resource: { buffer: this.angleBuf } },
        ],
      });

      this.ready = true;
      console.log('GpuAngleCalculator: WebGPU initialized.');
      return true;
    } catch (e) {
      console.warn('GpuAngleCalculator: WebGPU init failed, will use CPU.', e);
      return false;
    }
  }

  async compute(landmarks: any[]): Promise<Record<string, number>> {
    if (!this.ready || !this.device || !this.pipeline ||
        !this.landmarkBuf || !this.angleBuf || !this.readbackBuf || !this.bindGroup) {
      return getJointAngles(landmarks);
    }

    // Pack landmarks into flat Float32Array
    const lmData = new Float32Array(LM_COUNT * FLOATS_PER_LM);
    for (let i = 0; i < LM_COUNT; i++) {
      const lm = landmarks[i] ?? { x: 0, y: 0, z: 0, visibility: 0 };
      lmData[i * FLOATS_PER_LM]     = lm.x;
      lmData[i * FLOATS_PER_LM + 1] = lm.y;
      lmData[i * FLOATS_PER_LM + 2] = lm.z ?? 0;
      lmData[i * FLOATS_PER_LM + 3] = lm.visibility ?? 1;
    }

    this.device.queue.writeBuffer(this.landmarkBuf, 0, lmData);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(1);
    pass.end();
    encoder.copyBufferToBuffer(this.angleBuf, 0, this.readbackBuf, 0, ANGLE_BUF_BYTES);
    this.device.queue.submit([encoder.finish()]);

    await this.readbackBuf.mapAsync(GPUMapMode.READ);
    const result = new Float32Array(this.readbackBuf.getMappedRange().slice(0));
    this.readbackBuf.unmap();

    const out: Record<string, number> = {};
    ANGLE_KEYS.forEach((key, i) => { out[key] = result[i]; });
    return out;
  }

  destroy() {
    this.landmarkBuf?.destroy();
    this.angleBuf?.destroy();
    this.readbackBuf?.destroy();
    this.device?.destroy();
    this.device = null;
    this.ready = false;
  }
}

// Singleton — one GPU context for the whole app
export const gpuAngleCalculator = new GpuAngleCalculator();
