import { PoseLockService } from './poseLockService';

function mockLandmarks(visibility: number, offsetX = 0): any[] {
  const pts: any[] = [];
  for (const i of [0, 11, 12, 23, 24, 25, 26, 27, 28]) {
    pts[i] = { x: 0.5 + offsetX, y: 0.5, z: 0, visibility };
  }
  return pts;
}

function mockResults(visibility: number, offsetX = 0): any {
  return { poseLandmarks: mockLandmarks(visibility, offsetX) };
}

function fill(svc: PoseLockService, vis: number, n: number, offsetX = 0): any {
  let r: any = null;
  for (let i = 0; i < n; i++) r = svc.filter(mockResults(vis, offsetX));
  return r;
}

describe('PoseLockService hysteresis', () => {
  let svc: PoseLockService;

  beforeEach(() => {
    svc = new PoseLockService();
  });

  it('acquires lock at high confidence (≥0.7)', () => {
    const r = fill(svc, 0.75, 3);
    expect(r).not.toBeNull();
  });

  it('does not acquire lock on a single high-confidence spike', () => {
    const r = svc.filter(mockResults(0.75));
    expect(r).toBeNull();
  });

  it('does not acquire lock on intermittent high confidence (flicker guard)', () => {
    for (let i = 0; i < 10; i++) {
      const r = svc.filter(mockResults(i % 2 === 0 ? 0.75 : 0.55));
      expect(r).toBeNull();
    }
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

  it('does not release on a single low-confidence frame', () => {
    fill(svc, 0.75, 5); // lock
    const r = svc.filter(mockResults(0.35)); // single low-confidence frame
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
    const r = svc.filter(mockResults(0.75)); // single 0.75 — not enough frames
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
    expect(r).not.toBeNull(); // still locked
  });

  it('holds the lock through a brief continuity breach', () => {
    fill(svc, 0.75, 5);       // lock at offset 0
    const r = svc.filter(mockResults(0.75, 0.5)); // single big jump
    expect(r).not.toBeNull(); // debounced — still locked
  });

  it('releases the lock on a sustained continuity breach', () => {
    fill(svc, 0.75, 5);       // lock at offset 0
    const r = fill(svc, 0.75, 4, 0.5); // sustained jump far from locked centroid
    expect(r).toBeNull();     // breach debounce (3 frames) exceeded → released
  });

  it('recovers the lock after continuity breach then resumes normally', () => {
    fill(svc, 0.75, 5);                 // lock
    fill(svc, 0.75, 1, 0.5);            // brief breach (1 frame) — held
    const r = fill(svc, 0.75, 5, 0);    // back at original position
    expect(r).not.toBeNull();
  });
});
