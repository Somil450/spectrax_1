import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  OverlayRenderer,
  smoothLandmarks,
  pulsePhase,
  scanLineY,
  POSE_CONNECTIONS_33,
  PULSE_PERIOD_MS,
} from "./overlayRenderer";

function createMockCtx() {
  const gradient = { addColorStop: vi.fn() };
  const ctx: any = {
    canvas: { width: 640, height: 480 },
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    fillText: vi.fn(),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    shadowColor: "",
    shadowBlur: 0,
    font: "",
  };
  return { ctx, gradient };
}

function buildLandmarks(n = 33): any[] {
  const pts: any[] = [];
  for (let i = 0; i < n; i++) {
    pts[i] = { x: 0.3 + i * 0.01, y: 0.3 + i * 0.01, z: 0, visibility: 0.95 };
  }
  return pts;
}

describe("smoothLandmarks", () => {
  it("returns the raw landmarks when there is no previous frame", () => {
    const next = buildLandmarks();
    const out = smoothLandmarks(null, next);
    expect(out.length).toBe(33);
    expect(out[0]).toEqual(next[0]);
  });

  it("interpolates toward the new position by the alpha factor", () => {
    const prev = buildLandmarks();
    const next = buildLandmarks().map((lm) => ({ ...lm, x: lm.x + 0.2, y: lm.y + 0.2 }));    const out = smoothLandmarks(prev, next, 0.5);
    expect(out[0].x).toBeCloseTo(prev[0].x + 0.1, 5);
    expect(out[0].y).toBeCloseTo(prev[0].y + 0.1, 5);
  });

  it("damps hard when the new joint visibility is very low", () => {
    const prev = buildLandmarks();
    const next = buildLandmarks().map((lm) => ({
      ...lm,
      x: lm.x + 0.2,
      visibility: 0.1,
    }));
    const out = smoothLandmarks(prev, next, 0.5);
    // effective alpha = 0.125 → movement is heavily suppressed
    expect(out[0].x).toBeCloseTo(prev[0].x + 0.025, 5);
  });

  it("falls back to the previous joint when the new one is missing", () => {
    const prev = buildLandmarks();
    const next: any[] = [...buildLandmarks()];
    next[5] = null;
    const out = smoothLandmarks(prev, next, 0.5);
    expect(out[5]).toEqual(prev[5]);
  });

  it("starts fresh when the landmark count changes", () => {
    const prev = buildLandmarks();
    const next = buildLandmarks(20);
    const out = smoothLandmarks(prev, next, 0.5);
    expect(out.length).toBe(20);
    expect(out[0]).toEqual(next[0]);
  });
});

describe("pulsePhase", () => {
  it("stays within [0, 1]", () => {
    for (const t of [0, 100, 400, PULSE_PERIOD_MS / 2, PULSE_PERIOD_MS, 5000]) {
      const p = pulsePhase(t);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it("is a cosine wave peaking at the start of each period", () => {
    expect(pulsePhase(0, PULSE_PERIOD_MS)).toBeCloseTo(1, 5);
    expect(pulsePhase(PULSE_PERIOD_MS / 2, PULSE_PERIOD_MS)).toBeCloseTo(0, 5);
    expect(pulsePhase(PULSE_PERIOD_MS, PULSE_PERIOD_MS)).toBeCloseTo(1, 5);
  });

  it("is periodic over the pulse period", () => {
    expect(pulsePhase(0, PULSE_PERIOD_MS)).toBeCloseTo(pulsePhase(PULSE_PERIOD_MS, PULSE_PERIOD_MS), 5);
  });
});

describe("scanLineY", () => {
  it("starts at the top of the frame", () => {
    expect(scanLineY(480, 0)).toBe(0);
  });

  it("never leaves the frame bounds", () => {
    for (const t of [0, 1, 100, 1000, 10000, 100000]) {
      const y = scanLineY(480, t);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(480);
    }
  });

  it("sweeps back and forth (triangle wave)", () => {
    const speed = 1;
    // bottom of the frame at the midpoint of the down-sweep
    expect(scanLineY(480, 480, speed)).toBeCloseTo(480, 5);
    // back at the top after a full cycle
    expect(scanLineY(480, 960, speed)).toBeCloseTo(0, 5);
    // the up-sweep mirrors the down-sweep
    expect(scanLineY(480, 240, speed)).toBeCloseTo(scanLineY(480, 720, speed), 5);
    expect(scanLineY(480, 60, speed)).toBeLessThan(scanLineY(480, 180, speed));
  });

  it("returns 0 for a zero-height canvas", () => {
    expect(scanLineY(0, 100)).toBe(0);
  });
});

describe("OverlayRenderer.draw", () => {
  let mock: ReturnType<typeof createMockCtx>;
  let renderer: OverlayRenderer;

  beforeEach(() => {
    mock = createMockCtx();
    renderer = new OverlayRenderer();
    renderer.setContext(mock.ctx as any);
  });

  it("skips drawing without pose landmarks", () => {
    renderer.draw({} as any, "green", [], []);
    expect(mock.ctx.clearRect).not.toHaveBeenCalled();
  });

  it("draws connectors, joints, the scan line and the center of mass", () => {
    renderer.draw({ poseLandmarks: buildLandmarks() } as any, "green", [11], [26]);

    expect(mock.ctx.clearRect).toHaveBeenCalled();
    // Two connector passes (dim + glow) plus joint arcs etc.
    expect(mock.ctx.stroke.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mock.ctx.arc.mock.calls.length).toBeGreaterThanOrEqual(33);
    // Pulsing glow halos are radial gradients on primary/error joints
    expect(mock.ctx.createRadialGradient).toHaveBeenCalled();
    // Animated scan line uses a linear gradient
    expect(mock.ctx.createLinearGradient).toHaveBeenCalled();
    // CoM text
    expect(mock.ctx.fillText).toHaveBeenCalled();
  });

  it("smooths landmarks across consecutive draws", () => {
    const results = { poseLandmarks: buildLandmarks() } as any;
    renderer.draw(results, "green", [], []);
    const moved = buildLandmarks().map((lm) => ({ ...lm, x: lm.x + 0.5 }));
    renderer.draw({ poseLandmarks: moved } as any, "green", [], []);

    // draw() should never throw and should keep using the smoothing buffer
    expect(mock.ctx.clearRect).toHaveBeenCalledTimes(2);
    expect(mock.ctx.stroke.mock.calls.length).toBeGreaterThan(0);
  });

  it("resetSmoothing clears the smoothing history", () => {
    renderer.draw({ poseLandmarks: buildLandmarks() } as any, "green", [], []);
    renderer.resetSmoothing();
    renderer.draw({ poseLandmarks: buildLandmarks() } as any, "green", [], []);
    expect(mock.ctx.clearRect).toHaveBeenCalledTimes(2);
  });
});

describe("POSE_CONNECTIONS_33", () => {
  it("contains the standard mediapipe connection graph", () => {
    expect(POSE_CONNECTIONS_33).toContainEqual([11, 12]);
    expect(POSE_CONNECTIONS_33).toContainEqual([23, 24]);
    expect(POSE_CONNECTIONS_33).toContainEqual([25, 27]);
    expect(POSE_CONNECTIONS_33).toContainEqual([28, 30]);
    expect(POSE_CONNECTIONS_33).toContainEqual([30, 32]);
  });
});
