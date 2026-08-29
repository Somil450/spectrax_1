/**
 * cameraService.test.ts
 *
 * Unit tests for the skeleton overlay drawing functions in
 * src/services/cameraService.ts (issue #1041).
 *
 * Strategy:
 *   - We mock a 2D canvas rendering context and assert that
 *     drawLandmarksOnCanvas issues the expected drawing calls
 *     (stroke, fill, fillText) for each throttle level, including
 *     level 0 which previously drew nothing because drawFullSkeleton
 *     was an empty stub.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { drawLandmarksOnCanvas } from '../cameraService';

/** Build a landmarks array of 33 visible joints. */
function visibleLandmarks() {
  return Array.from({ length: 33 }, (_, i) => ({
    x: (i % 4) / 4,
    y: (i % 3) / 3,
    z: 0,
    visibility: 0.9,
  }));
}

function makeMockContext() {
  const ctx: any = {
    canvas: { width: 320, height: 240 },
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    arc: vi.fn(),
    strokeRect: vi.fn(),
  };
  return ctx;
}

// NOTE: throttle level subscriptions live at module scope in cameraService.ts.
// The level starts at 0 (throttleMonitor.getCurrentLevel()), so the default
// path exercised below is the full-skeleton overlay.
describe('drawLandmarksOnCanvas', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('draws skeleton connections, joints and labels at throttle level 0', () => {
    const ctx = makeMockContext();
    const landmarks = visibleLandmarks();
    drawLandmarksOnCanvas(ctx, landmarks);

    // Connections: many stroke() calls, one per visible connection pair.
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(10);
    // Joints: filled circles (33 joints).
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fill.mock.calls.length).toBe(33);
    // Labels: 12 labelled joints.
    expect(ctx.fillText).toHaveBeenCalled();
    expect(ctx.fillText.mock.calls.length).toBe(12);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('does not crash when given no landmarks', () => {
    const ctx = makeMockContext();
    expect(() => drawLandmarksOnCanvas(ctx, [])).not.toThrow();
    expect(() => drawLandmarksOnCanvas(ctx, null as any)).not.toThrow();
  });

  it('skips low-visibility joints entirely', () => {
    const ctx = makeMockContext();
    const landmarks = Array.from({ length: 33 }, () => ({
      x: 0.5,
      y: 0.5,
      z: 0,
      visibility: 0.1,
    }));
    drawLandmarksOnCanvas(ctx, landmarks);
    // No visible joints -> no joint circles, no connections, no labels.
    expect(ctx.fill).not.toHaveBeenCalled();
    expect(ctx.fillText).not.toHaveBeenCalled();
  });
});
