import { describe, it, expect, beforeEach } from "vitest";
import {
  MultiPersonMonitor,
  computePersonMetrics,
  selectPrimaryUser,
  PERSON_SWITCH_WINDOW_MS,
} from "./multiPersonDetection";

type LM = { x?: number; y?: number; visibility?: number };

const lm = (x: number, y: number, visibility = 1): LM => ({ x, y, visibility });

// A roughly human-shaped landmark set occupying the middle of the frame
const standingPerson = (): LM[] => {
  const pts: LM[] = [];
  for (let i = 0; i < 33; i++) pts[i] = { x: 0.5, y: 0.5, visibility: 0 };
  pts[0] = lm(0.5, 0.15);
  pts[11] = lm(0.45, 0.32);
  pts[12] = lm(0.55, 0.32);
  pts[23] = lm(0.46, 0.5);
  pts[24] = lm(0.54, 0.5);
  pts[25] = lm(0.47, 0.66);
  pts[26] = lm(0.53, 0.66);
  pts[27] = lm(0.48, 0.82);
  pts[28] = lm(0.52, 0.82);
  pts[29] = lm(0.48, 0.84);
  pts[30] = lm(0.52, 0.84);
  pts[31] = lm(0.49, 0.86);
  pts[32] = lm(0.51, 0.86);
  return pts;
};

describe("computePersonMetrics", () => {
  it("computes bounding-box area and centroid from a full skeleton", () => {
    const m = computePersonMetrics(standingPerson());
    expect(m.area).toBeCloseTo(0.1 * 0.71, 5);
    expect(m.centroidX).toBeCloseTo(0.5, 4);
    expect(m.centroidY).toBeGreaterThan(0.6);
    expect(m.centroidY).toBeLessThan(0.66);
    expect(m.avgVisibility).toBeGreaterThan(0.99);
  });

  it("treats a completely empty landmark set as a zero-area fallback", () => {
    const m = computePersonMetrics([]);
    expect(m.area).toBe(0);
    expect(m.centroidX).toBe(0.5);
    expect(m.centroidY).toBe(0.5);
    expect(m.avgVisibility).toBe(0);
  });
});

describe("selectPrimaryUser", () => {
  it("returns no primary when there are no candidates", () => {
    expect(selectPrimaryUser([])).toEqual({ primaryIndex: -1, peopleCount: 0 });
  });

  it("picks the largest person as the primary user", () => {
    const big = standingPerson();
    const small = standingPerson().map((p, i) =>
      i <= 10 ? p : lm((p.x! - 0.5) * 0.4 + 0.5, (p.y! - 0.5) * 0.4 + 0.5),
    );
    const { primaryIndex, peopleCount } = selectPrimaryUser([
      { landmarks: small },
      { landmarks: big },
    ]);
    expect(peopleCount).toBe(2);
    expect(primaryIndex).toBe(1);
  });

  it("breaks area ties on average visibility", () => {
    const crisp = standingPerson();
    const blurry = standingPerson().map((p, i) =>
      i === 0 || (i >= 11 && i <= 32)
        ? { ...p, visibility: 0.4 }
        : p,
    );
    const { primaryIndex } = selectPrimaryUser([
      { landmarks: blurry },
      { landmarks: crisp },
    ]);
    expect(primaryIndex).toBe(1);
  });

  it("breaks area + visibility ties on proximity to frame center", () => {
    const center = standingPerson();
    const edge = standingPerson().map((p) =>
      p.x !== undefined ? lm(p.x + 0.2, p.y) : p,
    );
    const { primaryIndex } = selectPrimaryUser([
      { landmarks: edge },
      { landmarks: center },
    ]);
    expect(primaryIndex).toBe(1);
  });
});

describe("MultiPersonMonitor", () => {
  let monitor: MultiPersonMonitor;

  beforeEach(() => {
    monitor = new MultiPersonMonitor();
  });

  it("does not warn for a single user even after many frames", () => {
    for (let i = 0; i < 100; i++) {
      const state = monitor.observe({ peopleCount: 1, personSwitch: false });
      expect(state.crowdWarning).toBe(false);
    }
  });

  it("warns immediately when multiple people are counted", () => {
    const state = monitor.observe({ peopleCount: 2 });
    expect(state.crowdWarning).toBe(true);
  });

  it("warns after several rapid person-switches within the window", () => {
    let state = monitor.observe({ personSwitch: true, now: 1000 });
    expect(state.crowdWarning).toBe(false);
    state = monitor.observe({ personSwitch: true, now: 1200 });
    expect(state.crowdWarning).toBe(false);
    state = monitor.observe({ personSwitch: true, now: 1400 });
    expect(state.crowdWarning).toBe(true);
  });

  it("ignores person-switches that fall outside the tracking window", () => {
    monitor.observe({ personSwitch: true, now: 0 });
    monitor.observe({ personSwitch: true, now: 1000 });
    // Old switches expired — the two fresh ones alone are not enough
    const state = monitor.observe({ personSwitch: true, now: 2000 + PERSON_SWITCH_WINDOW_MS });
    expect(state.crowdWarning).toBe(false);
  });

  it("clears the warning only after the debounce period of stable frames", () => {
    monitor.observe({ peopleCount: 2 });
    expect(monitor.observe({ peopleCount: 1, personSwitch: false }).crowdWarning).toBe(true);
    for (let i = 0; i < 28; i++) {
      expect(monitor.observe({ peopleCount: 1, personSwitch: false }).crowdWarning).toBe(true);
    }
    const state = monitor.observe({ peopleCount: 1, personSwitch: false });
    expect(state.crowdWarning).toBe(false);
  });

  it("re-warns if the crowd returns after the warning cleared", () => {
    for (let i = 0; i < 40; i++) monitor.observe({ peopleCount: 1 });
    expect(monitor.observe({ peopleCount: 1 }).crowdWarning).toBe(false);
    expect(monitor.observe({ peopleCount: 3 }).crowdWarning).toBe(true);
  });
});
