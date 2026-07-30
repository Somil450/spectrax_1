import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tensorflow/tfjs', () => ({
  ready: vi.fn().mockResolvedValue(undefined),
  setBackend: vi.fn().mockResolvedValue(undefined),
  memory: vi.fn().mockReturnValue({ numTensors: 10, numBytes: 102400 }),
  tidy: vi.fn((fn) => fn()),
  disposeVariables: vi.fn(),
}));

vi.mock('@tensorflow-models/pose-detection', () => ({
  SupportedModels: { BlazePose: 'BlazePose' },
  createDetector: vi.fn().mockResolvedValue({
    estimatePoses: vi.fn().mockResolvedValue([{ keypoints: [] }]),
    dispose: vi.fn(),
  }),
}));

import { tfjsPoseService } from '../tfjs';

describe('TFJSPoseService Memory Management & Performance Monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides valid initial memory and performance metrics', () => {
    const memoryInfo = tfjsPoseService.getMemoryInfo();
    expect(memoryInfo).toHaveProperty('numTensors');
    expect(memoryInfo).toHaveProperty('numBytes');
    expect(memoryInfo).toHaveProperty('fps');
    expect(memoryInfo).toHaveProperty('resolutionScale');
    expect(memoryInfo.resolutionScale).toBeGreaterThan(0);
  });

  it('handles empty/null frames gracefully without throwing', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;

    const poses = await tfjsPoseService.estimatePose(canvas);
    expect(Array.isArray(poses)).toBe(true);
  });

  it('disposes resources cleanly on dispose()', () => {
    expect(() => tfjsPoseService.dispose()).not.toThrow();
  });
});
