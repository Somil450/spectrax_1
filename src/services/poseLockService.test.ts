import { PoseLockService } from './poseLockService';

function mockLandmarks(visibility: number): any[] {
  const pts: any[] = [];
  for (const i of [0, 11, 12, 23, 24, 25, 26, 27, 28]) {
    pts[i] = { x: 0.5, y: 0.5, z: 0, visibility };
  }
  return pts;
}

function mockResults(visibility: number): any {
  return { poseLandmarks: mockLandmarks(visibility) };
}

function fill(svc: PoseLockService, vis: number, n: number): any {
  let r: any = null;
  for (let i = 0; i < n; i++) r = svc.filter(mockResults(vis));
  return r;
}

describe('PoseLockService hysteresis', () => {
  let svc: PoseLockService;

  beforeEach(() => {
    svc = new PoseLockService();
  });

  it('acquires lock at high confidence (≥0.7)', () => {
    const r = svc.filter(mockResults(0.75));
    expect(r).not.toBeNull();
  });

  it('stays unlocked at medium confidence (0.55)', () => {
    const r = svc.filter(mockResults(0.55));
    expect(r).toBeNull();
  });

  it('holds lock when confidence dips to 0.55 after acquisition', () => {
    fill(svc, 0.75, 5); // lock + fill rolling buffer
    const r = svc.filter(mockResults(0.55)); // single dip into dead-zone
    expect(r).not.toBeNull();
  });

  it('sustained low confidence (< 0.4) releases lock', () => {
    fill(svc, 0.75, 5); // lock + fill buffer
    const r = fill(svc, 0.35, 5); // 5 consecutive low-confidence frames
    expect(r).toBeNull();
  });

  it('requires re-acquisition after unlock', () => {
    fill(svc, 0.75, 5);   // lock + fill buffer
    fill(svc, 0.35, 5);   // unlock
    const r = fill(svc, 0.55, 5); // medium — should NOT re-lock (0.55 < 0.7)
    expect(r).toBeNull();
  });

  it('single-frame confidence spike does not cause false re-lock after unlock', () => {
    fill(svc, 0.75, 5);   // lock + fill buffer
    fill(svc, 0.35, 5);   // unlock
    const r = svc.filter(mockResults(0.75)); // single 0.75 — not enough to fill median
    expect(r).toBeNull();
  });

  it('sustained high confidence re-locks after unlock', () => {
    fill(svc, 0.75, 5);   // lock
    fill(svc, 0.35, 5);   // unlock
    const r = fill(svc, 0.75, 5); // 5 high-confidence frames → re-lock
    expect(r).not.toBeNull();
  });

  it('does not unlock on a single low-confidence outlier when locked', () => {
    fill(svc, 0.75, 5);       // lock
    const r = svc.filter(mockResults(0.3)); // single outlier at 0.3
    expect(r).not.toBeNull(); // still locked — median hasn't dipped below 0.4
  });
});
