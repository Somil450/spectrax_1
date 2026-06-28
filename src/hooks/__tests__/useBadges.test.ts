import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calculateStreak } from '../useBadges';

describe('calculateStreak (local-day bucketing)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts two workouts on consecutive local days as a streak of 2, even across the UTC day boundary', () => {
    // "now" = Jan 2, 1am local.
    vi.setSystemTime(new Date(2024, 0, 2, 1, 0, 0));
    const dates = [
      new Date(2024, 0, 1, 23, 0, 0).toISOString(), // Jan 1, 11pm local
      new Date(2024, 0, 2, 1, 0, 0).toISOString(), // Jan 2, 1am local
    ];
    // UTC bucketing collapses these into one day in non-UTC timezones; local
    // bucketing keeps them on Jan 1 and Jan 2.
    expect(calculateStreak(dates)).toBe(2);
  });

  it('counts a simple three-day local streak', () => {
    vi.setSystemTime(new Date(2024, 0, 3, 12, 0, 0));
    const dates = [
      new Date(2024, 0, 1, 12, 0, 0).toISOString(),
      new Date(2024, 0, 2, 12, 0, 0).toISOString(),
      new Date(2024, 0, 3, 12, 0, 0).toISOString(),
    ];
    expect(calculateStreak(dates)).toBe(3);
  });

  it('returns 0 when the most recent workout is older than yesterday', () => {
    vi.setSystemTime(new Date(2024, 0, 10, 12, 0, 0));
    const dates = [new Date(2024, 0, 1, 12, 0, 0).toISOString()];
    expect(calculateStreak(dates)).toBe(0);
  });
});
