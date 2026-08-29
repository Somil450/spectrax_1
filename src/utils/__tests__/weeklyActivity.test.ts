import { describe, it, expect } from "vitest";
import { getWeeklyActivity, toLocalDayKey } from "../weeklyActivity";

describe("toLocalDayKey", () => {
  it("formats a local date as zero-padded YYYY-MM-DD", () => {
    const d = new Date(2026, 7, 2); // Aug 2 2026 local
    expect(toLocalDayKey(d)).toBe("2026-08-02");
  });
});

describe("getWeeklyActivity", () => {
  it("returns 7 days ending today with zero activity when no workouts", () => {
    const now = new Date(2026, 7, 2, 15, 30); // local Aug 2 2026
    const result = getWeeklyActivity([], now);

    expect(result).toHaveLength(7);
    expect(result[6].isToday).toBe(true);
    expect(result[6].key).toBe("2026-08-02");
    expect(result.every((d) => d.reps === 0 && d.minutes === 0 && d.sessions === 0)).toBe(true);
  });

  it("labels days Mon..Sun when the window ends on a Sunday", () => {
    const now = new Date(2026, 7, 2); // Aug 2 2026 is a Sunday
    const result = getWeeklyActivity([], now);
    expect(result.map((d) => d.label)).toEqual([
      "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
    ]);
  });

  it("accumulates reps and minutes for a workout on its local day", () => {
    const now = new Date(2026, 7, 2, 20, 0); // Sun Aug 2
    const todayTs = new Date(2026, 7, 2, 10, 15).getTime();
    const result = getWeeklyActivity(
      [{ timestamp: todayTs, totalReps: 30, duration: 570 }], // 9.5 min → 10
      now,
    );

    const today = result[6];
    expect(today.reps).toBe(30);
    expect(today.minutes).toBe(10);
    expect(today.sessions).toBe(1);
  });

  it("aggregates multiple workouts across different days", () => {
    const now = new Date(2026, 7, 2, 20, 0);
    const workouts = [
      { timestamp: new Date(2026, 7, 2, 9, 0).getTime(), totalReps: 30, duration: 600 },
      { timestamp: new Date(2026, 7, 2, 18, 0).getTime(), totalReps: 15, duration: 300 },
      { timestamp: new Date(2026, 7, 1, 12, 0).getTime(), totalReps: 45, duration: 900 },
      { timestamp: new Date(2026, 6, 28, 12, 0).getTime(), totalReps: 10, duration: 120 },
    ];
    const result = getWeeklyActivity(workouts, now);

    // Today: two workouts summed
    expect(result[6].reps).toBe(45);
    expect(result[6].sessions).toBe(2);
    // Yesterday (Sat Aug 1)
    expect(result[5].key).toBe("2026-08-01");
    expect(result[5].reps).toBe(45);
    expect(result[5].minutes).toBe(15);
    // Tue Jul 28
    expect(result[1].key).toBe("2026-07-28");
    expect(result[1].reps).toBe(10);
    expect(result[1].minutes).toBe(2);
  });

  it("ignores workouts older than 7 days", () => {
    const now = new Date(2026, 7, 2, 20, 0);
    const oldTs = new Date(2026, 6, 25, 12, 0).getTime(); // Jul 25 — 8 days back
    const result = getWeeklyActivity(
      [{ timestamp: oldTs, totalReps: 99, duration: 999 }],
      now,
    );

    expect(result.every((d) => d.reps === 0 && d.sessions === 0)).toBe(true);
  });

  it("ignores future workouts", () => {
    const now = new Date(2026, 7, 2, 20, 0);
    const futureTs = new Date(2026, 7, 5, 12, 0).getTime();
    const result = getWeeklyActivity(
      [{ timestamp: futureTs, totalReps: 99, duration: 999 }],
      now,
    );

    expect(result.every((d) => d.sessions === 0)).toBe(true);
  });

  it("clamps negative reps and durations to zero", () => {
    const now = new Date(2026, 7, 2, 20, 0);
    const todayTs = new Date(2026, 7, 2, 10, 0).getTime();
    const result = getWeeklyActivity(
      [{ timestamp: todayTs, totalReps: -5, duration: -10 }],
      now,
    );

    expect(result[6].reps).toBe(0);
    expect(result[6].minutes).toBe(0);
  });

  it("rounds duration to the nearest minute", () => {
    const now = new Date(2026, 7, 2, 20, 0);
    const todayTs = new Date(2026, 7, 2, 10, 0).getTime();
    const result = getWeeklyActivity(
      [
        { timestamp: todayTs, totalReps: 10, duration: 29 },
        { timestamp: todayTs, totalReps: 5, duration: 61 },
      ],
      now,
    );

    // 29s → 0min, 61s → 1min
    expect(result[6].minutes).toBe(1);
  });

  it("flags only the last day as today", () => {
    const now = new Date(2026, 7, 2, 20, 0);
    const result = getWeeklyActivity([], now);
    expect(result.filter((d) => d.isToday)).toHaveLength(1);
    expect(result[6].isToday).toBe(true);
  });
});
