/**
 * gestureService.ts
 *
 * Dynamic hand-gesture parsing that maps MediaPipe pose landmarks to
 * discrete workout control commands (START / PAUSE / STOP).
 *
 * Gesture → Command mapping
 * ──────────────────────────────────────────────────────────────────
 *  BOTH palms raised above shoulders   →  START  (begin / resume workout)
 *  ONE  palm raised above shoulder     →  PAUSE  (pause mid-set)
 *  Crossed arms at chest level         →  STOP   (finish session)
 *  Thumbs-up (either hand)             →  START  (alias for resume/start)
 *
 * Design decisions
 * ──────────────────────────────────────────────────────────────────
 *  • Each gesture has its own independent frame buffer so gestures
 *    cannot bleed into each other's confidence windows.
 *  • A command is only emitted once per hold (debounced by a
 *    `commandCooldownMs` guard) so holding the pose doesn't spam events.
 *  • `parseCommand()` returns `null` when no gesture crosses the
 *    confidence threshold, keeping the caller's hot path branchless.
 *  • All thresholds are exported constants so unit tests can override them.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

/** Commands that can be triggered by a hand gesture. */
export type GestureCommand = 'START' | 'PAUSE' | 'STOP';

/** Full analysis result returned by `gestureService.analyze()`. */
export interface GestureResult {
  isHandRaised: boolean;
  confidence: number;
  leftWristAboveShoulder: boolean;
  rightWristAboveShoulder: boolean;
  isPoseLost: boolean;
  isThumbsUp?: boolean;
  isCrossedArms: boolean;
  /** Single-palm (one-handed) raise detected */
  isSingleHandRaised: boolean;
  /** Parsed workout control command, or null if no gesture fired */
  command: GestureCommand | null;
  /** Per-gesture confidence scores [0-1] for UI display */
  gestureConfidences: Record<GestureCommand, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tuneable constants
// ─────────────────────────────────────────────────────────────────────────────

export const VISIBILITY_THRESHOLD = 0.5;
/** Frames a gesture must be held to fire a command (each buffer is this size) */
export const GESTURE_BUFFER_SIZE = 12;
/** Fraction of buffer frames that must be positive to emit the command */
export const GESTURE_CONFIDENCE_THRESHOLD = 0.75;
/** Minimum ms between two identical command emissions (debounce) */
export const COMMAND_COOLDOWN_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// MediaPipe landmark indices
// ─────────────────────────────────────────────────────────────────────────────

const IDX = {
  LEFT_SHOULDER:  11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW:     13,
  RIGHT_ELBOW:    14,
  LEFT_WRIST:     15,
  RIGHT_WRIST:    16,
  LEFT_PINKY:     17,
  RIGHT_PINKY:    18,
  LEFT_INDEX:     19,
  RIGHT_INDEX:    20,
  LEFT_THUMB:     21,
  RIGHT_THUMB:    22,
  LEFT_HIP:       23,
  RIGHT_HIP:      24,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// GestureService class
// ─────────────────────────────────────────────────────────────────────────────

class GestureService {
  // ── Per-gesture rolling frame buffers ──────────────────────────────────────
  private buffers: Record<GestureCommand, boolean[]> = {
    START: [],
    PAUSE: [],
    STOP:  [],
  };

  // ── Debounce: timestamp of the last emission per command ───────────────────
  private lastEmitted: Record<GestureCommand, number> = {
    START: 0,
    PAUSE: 0,
    STOP:  0,
  };

  // ── Low-level landmark helpers ─────────────────────────────────────────────

  /**
   * Average visibility across a set of landmark indices.
   * Returns 0 if `landmarks` is falsy or all indices are missing.
   */
  private avgVisibility(landmarks: any[], indices: number[]): number {
    if (!landmarks) return 0;
    const vals = indices.map(i => landmarks[i]?.visibility ?? 0).filter(v => v > 0);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }

  /**
   * Returns true when `sourceIdx` is visibly above `targetIdx`
   * by at least 5 % of normalised height (guards against noise).
   * "Above" in MediaPipe means lower y value.
   */
  private isAbove(landmarks: any[], sourceIdx: number, targetIdx: number): boolean {
    const src = landmarks[sourceIdx];
    const tgt = landmarks[targetIdx];
    if (!src || !tgt) return false;
    if (src.visibility < VISIBILITY_THRESHOLD || tgt.visibility < VISIBILITY_THRESHOLD) return false;
    return src.y < tgt.y - 0.05;
  }

  // ── Individual gesture detectors ──────────────────────────────────────────

  /** Both wrists raised above their respective shoulders. */
  private detectBothHandsRaised(lm: any[]): boolean {
    return (
      this.isAbove(lm, IDX.LEFT_WRIST,  IDX.LEFT_SHOULDER) &&
      this.isAbove(lm, IDX.RIGHT_WRIST, IDX.RIGHT_SHOULDER)
    );
  }

  /** Exactly one wrist (left OR right, not both) raised above its shoulder. */
  private detectSingleHandRaised(lm: any[]): boolean {
    const leftUp  = this.isAbove(lm, IDX.LEFT_WRIST,  IDX.LEFT_SHOULDER);
    const rightUp = this.isAbove(lm, IDX.RIGHT_WRIST, IDX.RIGHT_SHOULDER);
    return leftUp !== rightUp; // XOR — exactly one
  }

  /**
   * Thumbs-up: thumb tip is the highest point of that hand,
   * index finger still below wrist level, hand at or above chest.
   * Works for either hand.
   */
  private detectThumbsUp(lm: any[]): boolean {
    const leftThumbUp =
      this.isAbove(lm, IDX.LEFT_THUMB,  IDX.LEFT_INDEX) &&
      this.isAbove(lm, IDX.LEFT_THUMB,  IDX.LEFT_PINKY) &&
      this.isAbove(lm, IDX.LEFT_INDEX,  IDX.LEFT_WRIST);

    const rightThumbUp =
      this.isAbove(lm, IDX.RIGHT_THUMB,  IDX.RIGHT_INDEX) &&
      this.isAbove(lm, IDX.RIGHT_THUMB,  IDX.RIGHT_PINKY) &&
      this.isAbove(lm, IDX.RIGHT_INDEX,  IDX.RIGHT_WRIST);

    return leftThumbUp || rightThumbUp;
  }

  /**
   * Crossed arms: both wrists very close together horizontally
   * and vertically, positioned between shoulder and hip (chest level).
   */
  private detectCrossedArms(lm: any[]): boolean {
    const lw = lm[IDX.LEFT_WRIST];
    const rw = lm[IDX.RIGHT_WRIST];
    const ls = lm[IDX.LEFT_SHOULDER];
    const lh = lm[IDX.LEFT_HIP];

    if (!lw || !rw || !ls || !lh) return false;
    if (lw.visibility < VISIBILITY_THRESHOLD || rw.visibility < VISIBILITY_THRESHOLD) return false;

    const distX = Math.abs(lw.x - rw.x);
    const distY = Math.abs(lw.y - rw.y);
    // Both wrists should be at chest level (between shoulder y and hip y in image-space)
    const atChest = lw.y > ls.y && lw.y < lh.y && rw.y > ls.y && rw.y < lh.y;

    return distX < 0.15 && distY < 0.15 && atChest;
  }

  // ── Frame-buffer rolling window ────────────────────────────────────────────

  /** Push one boolean observation into a gesture buffer; trim to window size. */
  private pushBuffer(cmd: GestureCommand, value: boolean): void {
    this.buffers[cmd].push(value);
    if (this.buffers[cmd].length > GESTURE_BUFFER_SIZE) {
      this.buffers[cmd].shift();
    }
  }

  /** Compute the fraction of positive frames in a buffer [0-1]. */
  private bufferConfidence(cmd: GestureCommand): number {
    const buf = this.buffers[cmd];
    if (buf.length === 0) return 0;
    return buf.filter(Boolean).length / buf.length;
  }

  // ── Command parser ─────────────────────────────────────────────────────────

  /**
   * Parse a single MediaPipe pose landmarks array and decide whether a
   * workout command should fire.
   *
   * Priority order (highest first):
   *   1. STOP  – crossed arms (unambiguous finish intent)
   *   2. START – both hands raised OR thumbs-up
   *   3. PAUSE – single hand raised
   *
   * Returns the command string, or null if nothing has crossed threshold.
   */
  parseCommand(landmarks: any[]): GestureCommand | null {
    if (!landmarks || landmarks.length < 33) return null;

    // Detect raw gestures this frame
    const crossed    = this.detectCrossedArms(landmarks);
    const bothUp     = this.detectBothHandsRaised(landmarks);
    const thumbsUp   = this.detectThumbsUp(landmarks);
    const singleUp   = !bothUp && this.detectSingleHandRaised(landmarks);

    // Feed each gesture's own buffer
    this.pushBuffer('STOP',  crossed);
    this.pushBuffer('START', bothUp || thumbsUp);
    this.pushBuffer('PAUSE', singleUp);

    const now = Date.now();

    // Evaluate in priority order
    const candidates: GestureCommand[] = ['STOP', 'START', 'PAUSE'];
    for (const cmd of candidates) {
      const conf = this.bufferConfidence(cmd);
      if (
        conf >= GESTURE_CONFIDENCE_THRESHOLD &&
        now - this.lastEmitted[cmd] >= COMMAND_COOLDOWN_MS
      ) {
        this.lastEmitted[cmd] = now;
        // Clear this buffer so the same command isn't re-emitted immediately
        this.buffers[cmd] = [];
        return cmd;
      }
    }

    return null;
  }

  // ── Full analysis (backward-compatible with existing consumers) ─────────────

  /**
   * Comprehensive landmark analysis.
   * Returns the full `GestureResult` including the parsed command.
   * Existing callers that only read `isHandRaised` / `isCrossedArms` etc.
   * continue to work unchanged.
   */
  analyze(landmarks: any[]): GestureResult {
    const empty: GestureResult = {
      isHandRaised: false,
      confidence: 0,
      leftWristAboveShoulder: false,
      rightWristAboveShoulder: false,
      isPoseLost: true,
      isThumbsUp: false,
      isCrossedArms: false,
      isSingleHandRaised: false,
      command: null,
      gestureConfidences: { START: 0, PAUSE: 0, STOP: 0 },
    };

    if (!landmarks || landmarks.length < 33) return empty;

    // Check body visibility
    const bodyVis = this.avgVisibility(landmarks, [
      IDX.LEFT_SHOULDER, IDX.RIGHT_SHOULDER,
      IDX.LEFT_HIP,      IDX.RIGHT_HIP,
    ]);
    if (bodyVis < VISIBILITY_THRESHOLD) return empty;

    // Raw gesture flags
    const leftWristAboveShoulder  = this.isAbove(landmarks, IDX.LEFT_WRIST,  IDX.LEFT_SHOULDER);
    const rightWristAboveShoulder = this.isAbove(landmarks, IDX.RIGHT_WRIST, IDX.RIGHT_SHOULDER);
    const bothHandsRaised         = leftWristAboveShoulder && rightWristAboveShoulder;
    const singleHandRaised        = leftWristAboveShoulder !== rightWristAboveShoulder;
    const isThumbsUpDetected      = this.detectThumbsUp(landmarks);
    const isCrossedArms           = this.detectCrossedArms(landmarks);

    // Update buffers and parse command (reuses parseCommand logic internals)
    this.pushBuffer('STOP',  isCrossedArms);
    this.pushBuffer('START', bothHandsRaised || isThumbsUpDetected);
    this.pushBuffer('PAUSE', singleHandRaised && !bothHandsRaised);

    // Legacy single-buffer confidence (both-hands or thumbs-up or crossed)
    const legacyActive = bothHandsRaised || isThumbsUpDetected || isCrossedArms;
    // Use a small private legacy buffer for backward-compat confidence
    if (!this._legacyBuffer) this._legacyBuffer = [];
    this._legacyBuffer.push(legacyActive);
    if (this._legacyBuffer.length > GESTURE_BUFFER_SIZE) this._legacyBuffer.shift();
    const legacyConf = this._legacyBuffer.filter(Boolean).length / this._legacyBuffer.length;

    // Command dispatch
    const now = Date.now();
    let firedCommand: GestureCommand | null = null;
    const candidates: GestureCommand[] = ['STOP', 'START', 'PAUSE'];
    for (const cmd of candidates) {
      const conf = this.bufferConfidence(cmd);
      if (
        conf >= GESTURE_CONFIDENCE_THRESHOLD &&
        now - this.lastEmitted[cmd] >= COMMAND_COOLDOWN_MS
      ) {
        this.lastEmitted[cmd] = now;
        this.buffers[cmd] = [];
        firedCommand = cmd;
        break;
      }
    }

    return {
      isHandRaised: legacyConf >= GESTURE_CONFIDENCE_THRESHOLD,
      confidence: legacyConf,
      leftWristAboveShoulder,
      rightWristAboveShoulder,
      isPoseLost: false,
      isThumbsUp: isThumbsUpDetected,
      isCrossedArms,
      isSingleHandRaised: singleHandRaised,
      command: firedCommand,
      gestureConfidences: {
        START: this.bufferConfidence('START'),
        PAUSE: this.bufferConfidence('PAUSE'),
        STOP:  this.bufferConfidence('STOP'),
      },
    };
  }

  /** Reset all internal state (call when a new workout session begins). */
  reset(): void {
    this.buffers = { START: [], PAUSE: [], STOP: [] };
    this.lastEmitted = { START: 0, PAUSE: 0, STOP: 0 };
    this._legacyBuffer = [];
  }

  // Private legacy buffer field (initialised lazily)
  private _legacyBuffer: boolean[] = [];
}

export const gestureService = new GestureService();
