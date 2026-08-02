/**
 * multiPersonDetection.ts
 * Multi-person detection prevention (issue #60).
 *
 * Keeps the app focused on a single user: the primary person is selected by
 * bounding-box size (foreground/largest) with tie-breaks on visibility and
 * proximity to the frame center, everyone else is ignored, and a debounced
 * warning is surfaced when more than one person is detected — either via an
 * explicit multi-person candidate count or via rapid person-switching in the
 * single-pose feed (the detector alternating between two people).
 */

export interface PersonMetrics {
  area: number;
  centroidX: number;
  centroidY: number;
  avgVisibility: number;
}

export interface PersonCandidate {
  landmarks: Array<{
    x?: number;
    y?: number;
    visibility?: number;
  }>;
}

export interface PrimaryUserResult {
  primaryIndex: number;
  peopleCount: number;
}

export interface MultiPersonState {
  peopleCount: number;
  crowdWarning: boolean;
  primaryIndex: number;
}

// Shoulders, elbows→hips/knees/ankles/feet + nose → stable bounding box
const SAMPLE_JOINTS = [0, 11, 12, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];

export const MULTI_PERSON_WARNING_THRESHOLD = 2;
export const PERSON_SWITCH_WINDOW_MS = 4000;
export const PERSON_SWITCH_COUNT = 3;
export const CROWD_CLEAR_DEBOUNCE_FRAMES = 30;

export function computePersonMetrics(
  landmarks?: Array<{ x?: number; y?: number; visibility?: number }>,
): PersonMetrics {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;
  let sumX = 0;
  let sumY = 0;
  let visSum = 0;
  let visCount = 0;
  let pointCount = 0;

  for (const i of SAMPLE_JOINTS) {
    const lm = landmarks?.[i];
    if (!lm) continue;
    if (typeof lm.x === "number") {
      minX = Math.min(minX, lm.x);
      maxX = Math.max(maxX, lm.x);
    }
    if (typeof lm.y === "number") {
      minY = Math.min(minY, lm.y);
      maxY = Math.max(maxY, lm.y);
    }
    sumX += lm.x ?? 0;
    sumY += lm.y ?? 0;
    if (typeof lm.visibility === "number") {
      visSum += lm.visibility;
      visCount++;
    }
    pointCount++;
  }

  return {
    area: Math.max(maxX - minX, 0) * Math.max(maxY - minY, 0),
    centroidX: pointCount > 0 ? sumX / pointCount : 0.5,
    centroidY: pointCount > 0 ? sumY / pointCount : 0.5,
    avgVisibility: visCount > 0 ? visSum / visCount : 0,
  };
}

const proximityToCenter = (m: PersonMetrics) =>
  Math.hypot(m.centroidX - 0.5, m.centroidY - 0.5);

/**
 * Picks the primary user out of several detected people.
 * Primary = largest bounding box (foreground person); ties are broken by
 * average visibility, then by proximity to the center of the frame.
 */
export function selectPrimaryUser(
  candidates: PersonCandidate[],
): PrimaryUserResult {
  const list = Array.isArray(candidates) ? candidates : [];
  if (list.length === 0) return { primaryIndex: -1, peopleCount: 0 };

  let primaryIndex = 0;
  let best = computePersonMetrics(list[0].landmarks);

  for (let i = 1; i < list.length; i++) {
    const m = computePersonMetrics(list[i].landmarks);
    const better =
      m.area > best.area ||
      (m.area === best.area && m.avgVisibility > best.avgVisibility) ||
      (m.area === best.area &&
        m.avgVisibility === best.avgVisibility &&
        proximityToCenter(m) < proximityToCenter(best));
    if (better) {
      primaryIndex = i;
      best = m;
    }
  }

  return { primaryIndex, peopleCount: list.length };
}

/**
 * Debounced crowd-warning state machine.
 *
 * - `peopleCount >= 2` (multi-person candidate feed) warns immediately.
 * - Rapid person-switching in a single-pose feed (>= PERSON_SWITCH_COUNT
 *   switches within PERSON_SWITCH_WINDOW_MS) warns too, since that is the
 *   signature of the detector alternating between two people.
 * - The warning clears after CROWD_CLEAR_DEBOUNCE_FRAMES of stable frames.
 */
export class MultiPersonMonitor {
  private switchTimes: number[] = [];
  private clearCounter = 0;
  private warning = false;
  private peopleCount = 1;
  private primaryIndex = 0;

  observe(observation: {
    peopleCount?: number;
    personSwitch?: boolean;
    now?: number;
  }): MultiPersonState {
    const now = observation.now ?? Date.now();

    if (observation.personSwitch) {
      this.switchTimes.push(now);
    }
    this.switchTimes = this.switchTimes.filter(
      (t) => now - t <= PERSON_SWITCH_WINDOW_MS,
    );

    if (typeof observation.peopleCount === "number") {
      this.peopleCount = observation.peopleCount;
    }

    const crowd =
      this.peopleCount >= MULTI_PERSON_WARNING_THRESHOLD ||
      this.switchTimes.length >= PERSON_SWITCH_COUNT;

    if (crowd) {
      this.warning = true;
      this.clearCounter = 0;
    } else {
      this.clearCounter++;
      if (this.clearCounter >= CROWD_CLEAR_DEBOUNCE_FRAMES) {
        this.warning = false;
      }
    }

    return {
      peopleCount: this.peopleCount,
      crowdWarning: this.warning,
      primaryIndex: this.primaryIndex,
    };
  }

  setPrimaryIndex(index: number) {
    this.primaryIndex = index;
  }

  reset() {
    this.switchTimes = [];
    this.clearCounter = 0;
    this.warning = false;
    this.peopleCount = 1;
    this.primaryIndex = 0;
  }
}
