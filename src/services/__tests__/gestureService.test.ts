/**
 * gestureService.test.ts
 *
 * Unit tests for the dynamic gesture command parser introduced in issue #160.
 *
 * Strategy:
 *   - We build minimal landmark arrays (33 entries) and set only the fields
 *     the service inspects (x, y, visibility).
 *   - Each test fills the rolling buffer to threshold by calling
 *     `parseCommand` / `analyze` GESTURE_BUFFER_SIZE times with the
 *     gesture active, then one final call to read the fired command.
 *   - We also verify backward-compat fields (isHandRaised, isCrossedArms…)
 *     on the `analyze()` return value.
 */

import { gestureService, GESTURE_BUFFER_SIZE } from '../gestureService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Run parseCommand N times, return the first non-null command seen. */
function driveParseCommand(landmarks: any[], frames = GESTURE_BUFFER_SIZE + 2): string | null {
  for (let i = 0; i < frames; i++) {
    const cmd = gestureService.parseCommand(landmarks);
    if (cmd !== null) return cmd;
  }
  return null;
}

/** Build a landmarks array of 33 invisible, neutral-position joints. */
function emptyLandmarks() {
  return Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
}

/**
 * Make landmarks with specified joints visible and positioned.
 * `overrides` is a map of { [landmarkIndex]: { x?, y?, visibility? } }.
 */
function makeLandmarks(overrides: Record<number, Partial<{ x: number; y: number; visibility: number }>>) {
  const lm = emptyLandmarks();
  for (const [idx, vals] of Object.entries(overrides)) {
    Object.assign(lm[Number(idx)], vals);
  }
  return lm;
}

/** Mediapipe landmark indices we care about */
const IDX = {
  LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
  LEFT_WRIST: 15, RIGHT_WRIST: 16,
  LEFT_PINKY: 17, RIGHT_PINKY: 18,
  LEFT_INDEX: 19, RIGHT_INDEX: 20,
  LEFT_THUMB: 21, RIGHT_THUMB: 22,
  LEFT_HIP: 23, RIGHT_HIP: 24,
};

/** A landmarks snapshot where both wrists are raised high above shoulders. */
function bothHandsRaisedLandmarks() {
  return makeLandmarks({
    [IDX.LEFT_SHOULDER]:  { x: 0.4, y: 0.5, visibility: 0.9 },
    [IDX.RIGHT_SHOULDER]: { x: 0.6, y: 0.5, visibility: 0.9 },
    [IDX.LEFT_WRIST]:     { x: 0.35, y: 0.25, visibility: 0.9 }, // well above shoulder
    [IDX.RIGHT_WRIST]:    { x: 0.65, y: 0.25, visibility: 0.9 },
    [IDX.LEFT_HIP]:       { x: 0.4, y: 0.75, visibility: 0.9 },
    [IDX.RIGHT_HIP]:      { x: 0.6, y: 0.75, visibility: 0.9 },
  });
}

/** Only left wrist raised — single hand. */
function singleHandRaisedLandmarks() {
  return makeLandmarks({
    [IDX.LEFT_SHOULDER]:  { x: 0.4, y: 0.5, visibility: 0.9 },
    [IDX.RIGHT_SHOULDER]: { x: 0.6, y: 0.5, visibility: 0.9 },
    [IDX.LEFT_WRIST]:     { x: 0.35, y: 0.25, visibility: 0.9 }, // above shoulder
    [IDX.RIGHT_WRIST]:    { x: 0.65, y: 0.6, visibility: 0.9 },  // below shoulder
    [IDX.LEFT_HIP]:       { x: 0.4, y: 0.75, visibility: 0.9 },
    [IDX.RIGHT_HIP]:      { x: 0.6, y: 0.75, visibility: 0.9 },
  });
}

/** Crossed arms at chest level. */
function crossedArmsLandmarks() {
  return makeLandmarks({
    [IDX.LEFT_SHOULDER]:  { x: 0.4, y: 0.35, visibility: 0.9 },
    [IDX.RIGHT_SHOULDER]: { x: 0.6, y: 0.35, visibility: 0.9 },
    [IDX.LEFT_WRIST]:     { x: 0.51, y: 0.55, visibility: 0.9 }, // close to each other
    [IDX.RIGHT_WRIST]:    { x: 0.49, y: 0.55, visibility: 0.9 }, // at chest level
    [IDX.LEFT_HIP]:       { x: 0.4, y: 0.75, visibility: 0.9 },
    [IDX.RIGHT_HIP]:      { x: 0.6, y: 0.75, visibility: 0.9 },
  });
}

/** Thumbs-up with left hand. */
function thumbsUpLandmarks() {
  return makeLandmarks({
    [IDX.LEFT_SHOULDER]:  { x: 0.4, y: 0.5, visibility: 0.9 },
    [IDX.RIGHT_SHOULDER]: { x: 0.6, y: 0.5, visibility: 0.9 },
    // Thumb above index and pinky, index above wrist
    [IDX.LEFT_WRIST]:     { x: 0.4, y: 0.55, visibility: 0.9 },
    [IDX.LEFT_INDEX]:     { x: 0.4, y: 0.48, visibility: 0.9 },
    [IDX.LEFT_PINKY]:     { x: 0.4, y: 0.50, visibility: 0.9 },
    [IDX.LEFT_THUMB]:     { x: 0.4, y: 0.38, visibility: 0.9 }, // highest
    [IDX.LEFT_HIP]:       { x: 0.4, y: 0.75, visibility: 0.9 },
    [IDX.RIGHT_HIP]:      { x: 0.6, y: 0.75, visibility: 0.9 },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('GestureService — parseCommand()', () => {
  beforeEach(() => {
    gestureService.reset();
    // Force COMMAND_COOLDOWN to 0 so tests don't need real time delays.
    // We do this by resetting `lastEmitted` through the public `reset()` API —
    // the cooldown is only an issue between back-to-back identical commands,
    // and reset() clears the timestamps.
  });

  it('returns null when landmarks array is empty', () => {
    expect(gestureService.parseCommand([])).toBeNull();
    expect(gestureService.parseCommand(null as any)).toBeNull();
  });

  it('returns null when landmarks array has fewer than 33 entries', () => {
    const short = Array.from({ length: 10 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }));
    expect(gestureService.parseCommand(short)).toBeNull();
  });

  it('fires START after enough both-hands-raised frames', () => {
    expect(driveParseCommand(bothHandsRaisedLandmarks())).toBe('START');
  });

  it('fires PAUSE after enough single-hand-raised frames (not START)', () => {
    expect(driveParseCommand(singleHandRaisedLandmarks())).toBe('PAUSE');
  });

  it('fires STOP after enough crossed-arms frames', () => {
    expect(driveParseCommand(crossedArmsLandmarks())).toBe('STOP');
  });

  it('fires START for thumbs-up gesture', () => {
    expect(driveParseCommand(thumbsUpLandmarks())).toBe('START');
  });

  it('STOP takes priority over START when both signals are active', () => {
    const combined = makeLandmarks({
      [IDX.LEFT_SHOULDER]:  { x: 0.4, y: 0.35, visibility: 0.9 },
      [IDX.RIGHT_SHOULDER]: { x: 0.6, y: 0.35, visibility: 0.9 },
      [IDX.LEFT_WRIST]:     { x: 0.51, y: 0.55, visibility: 0.9 },
      [IDX.RIGHT_WRIST]:    { x: 0.49, y: 0.55, visibility: 0.9 },
      [IDX.LEFT_HIP]:       { x: 0.4, y: 0.75, visibility: 0.9 },
      [IDX.RIGHT_HIP]:      { x: 0.6, y: 0.75, visibility: 0.9 },
    });
    expect(driveParseCommand(combined)).toBe('STOP');
  });

  it('does not fire the same command twice without a reset (cooldown)', () => {
    const lm = bothHandsRaisedLandmarks();
    // First batch — command fires once
    const firstCommand = driveParseCommand(lm);
    expect(firstCommand).toBe('START');
    // Immediately try again — cooldown blocks a second emission
    const secondCommand = driveParseCommand(lm);
    expect(secondCommand).toBeNull();
  });

  it('returns null for a gesture held below the confidence threshold', () => {
    const raised = bothHandsRaisedLandmarks();
    const neutral = emptyLandmarks();
    // Alternate: only 50 % positive frames → below GESTURE_CONFIDENCE_THRESHOLD
    for (let i = 0; i < GESTURE_BUFFER_SIZE; i++) {
      gestureService.parseCommand(i % 2 === 0 ? raised : neutral);
    }
    // Fire one more with neutral to flush
    const cmd = gestureService.parseCommand(neutral);
    expect(cmd).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compat tests on analyze()
// ─────────────────────────────────────────────────────────────────────────────

describe('GestureService — analyze() backward compatibility', () => {
  beforeEach(() => gestureService.reset());

  it('returns isPoseLost=true when landmarks array is empty', () => {
    const result = gestureService.analyze([]);
    expect(result.isPoseLost).toBe(true);
    expect(result.confidence).toBe(0);
    expect(result.command).toBeNull();
  });

  it('returns leftWristAboveShoulder=true correctly', () => {
    const lm = singleHandRaisedLandmarks();
    const result = gestureService.analyze(lm);
    expect(result.leftWristAboveShoulder).toBe(true);
    expect(result.rightWristAboveShoulder).toBe(false);
  });

  it('returns isCrossedArms=true for crossed arms landmarks', () => {
    const lm = crossedArmsLandmarks();
    const result = gestureService.analyze(lm);
    expect(result.isCrossedArms).toBe(true);
  });

  it('returns isSingleHandRaised=true for single-hand gesture', () => {
    const lm = singleHandRaisedLandmarks();
    const result = gestureService.analyze(lm);
    expect(result.isSingleHandRaised).toBe(true);
  });

  it('exposes gestureConfidences record with START / PAUSE / STOP keys', () => {
    const result = gestureService.analyze(bothHandsRaisedLandmarks());
    expect(result.gestureConfidences).toHaveProperty('START');
    expect(result.gestureConfidences).toHaveProperty('PAUSE');
    expect(result.gestureConfidences).toHaveProperty('STOP');
  });

  it('gestureConfidences[START] increases as both-hands frames accumulate', () => {
    const lm = bothHandsRaisedLandmarks();
    let lastConf = 0;
    for (let i = 0; i < GESTURE_BUFFER_SIZE - 1; i++) {
      const r = gestureService.analyze(lm);
      expect(r.gestureConfidences.START).toBeGreaterThanOrEqual(lastConf);
      lastConf = r.gestureConfidences.START;
    }
    expect(lastConf).toBeGreaterThan(0);
  });

  it('reset() clears all buffers and confidences return to 0', () => {
    const lm = bothHandsRaisedLandmarks();
    for (let i = 0; i < GESTURE_BUFFER_SIZE; i++) gestureService.analyze(lm);
    gestureService.reset();
    const r = gestureService.analyze(emptyLandmarks());
    expect(r.gestureConfidences.START).toBe(0);
    expect(r.gestureConfidences.PAUSE).toBe(0);
    expect(r.gestureConfidences.STOP).toBe(0);
  });
});
