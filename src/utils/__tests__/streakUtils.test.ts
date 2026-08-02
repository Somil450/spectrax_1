import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getWorkoutStreak,
  updateWorkoutStreak,
  toLocalDayKey,
  dayKeyToDayNumber,
} from '../streakUtils';

describe('streakUtils', () => {
  const STORAGE_KEY = 'spectrax_workout_streak';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('day key helpers', () => {
    it('formats local calendar days as YYYY-MM-DD', () => {
      expect(toLocalDayKey(new Date(2024, 0, 1, 23, 59, 59))).toBe('2024-01-01');
      expect(toLocalDayKey(new Date(2024, 11, 31))).toBe('2024-12-31');
    });

    it('computes timezone-stable day numbers from calendar components', () => {
      const jan1 = dayKeyToDayNumber('2024-01-01');
      const jan2 = dayKeyToDayNumber('2024-01-02');
      expect(jan2 - jan1).toBe(1);
      expect(dayKeyToDayNumber('2024-12-31') - jan1).toBe(365);
      expect(dayKeyToDayNumber('garbage')).toBeNaN();
    });
  });

  describe('getWorkoutStreak', () => {
    it('should return default values when no data is in localStorage', () => {
      const data = getWorkoutStreak();
      expect(data).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: null,
        version: 1,
      });
    });

    it('should return saved data from localStorage', () => {
      const mockData = {
        currentStreak: 5,
        longestStreak: 10,
        lastWorkoutDate: '2024-01-01',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));

      const data = getWorkoutStreak();
      expect(data.currentStreak).toBe(5);
      expect(data.longestStreak).toBe(10);
      expect(data.lastWorkoutDate).toBe('2024-01-01');
    });

    it('normalizes legacy toDateString() values to day keys', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: 3, longestStreak: 5, lastWorkoutDate: 'Sat Aug 02 2026' }),
      );
      const data = getWorkoutStreak();
      expect(data.lastWorkoutDate).toBe('2026-08-02');
    });
  });

  describe('updateWorkoutStreak', () => {
    it('should initialize streak on first workout', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        lastWorkoutDate: '2024-01-01',
        version: 1,
      });
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual(data);
    });

    it('should not increment streak if working out on the same day', () => {
      const initialDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(initialDate);
      updateWorkoutStreak();

      // Later same day
      vi.setSystemTime(new Date('2024-01-01T18:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data.currentStreak).toBe(1);
      expect(data.lastWorkoutDate).toBe('2024-01-01');
    });

    it('should increment streak if working out on the next consecutive day', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      updateWorkoutStreak();

      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data.currentStreak).toBe(2);
      expect(data.longestStreak).toBe(2);
      expect(data.lastWorkoutDate).toBe('2024-01-02');
    });

    it('should reset streak if a day is skipped', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      updateWorkoutStreak();

      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      updateWorkoutStreak();

      // Day 4 (skipped Day 3)
      vi.setSystemTime(new Date('2024-01-04T12:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data.currentStreak).toBe(1);
      expect(data.longestStreak).toBe(2); // Retains longest streak
      expect(data.lastWorkoutDate).toBe('2024-01-04');
    });

    it('increments when the legacy YYYY-MM-DD date is the previous day (any timezone)', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: 3, longestStreak: 3, lastWorkoutDate: '2024-01-01' }),
      );
      vi.setSystemTime(new Date(2024, 0, 2, 12, 0, 0));

      const data = updateWorkoutStreak();
      expect(data.currentStreak).toBe(4);
    });

    it('treats a legacy toDateString() value as the same local day (any timezone)', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: 3, longestStreak: 3, lastWorkoutDate: new Date(2024, 0, 2).toDateString() }),
      );
      vi.setSystemTime(new Date(2024, 0, 2, 18, 0, 0));

      const data = updateWorkoutStreak();
      expect(data.currentStreak).toBe(3);
    });
  });

  describe('timezone-shift robustness', () => {
    it('does not double-count a workout across a midnight boundary when a day is skipped in UTC but not locally', () => {
      // User in UTC+14: workout on local Jan 1 at 23:30 (UTC time is Jan 1 09:30).
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: 4, longestStreak: 4, lastWorkoutDate: '2024-01-01' }),
      );

      // Local "tomorrow" Jan 2 — the UTC instants land on Jan 2 in UTC too, but
      // the day key must come from local components, not toISOString().
      vi.setSystemTime(new Date(2024, 0, 2, 10, 0, 0));
      const data = updateWorkoutStreak();
      expect(data.currentStreak).toBe(5);
      expect(data.lastWorkoutDate).toBe('2024-01-02');
    });

    it('never lets a future-dated stored day (clock moved backwards) corrupt the streak', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: 6, longestStreak: 8, lastWorkoutDate: '2024-01-05' }),
      );
      vi.setSystemTime(new Date(2024, 0, 3, 9, 0, 0)); // "now" is before stored date

      const data = updateWorkoutStreak();
      expect(data.currentStreak).toBe(6);
      expect(data.longestStreak).toBe(8);
      expect(data.lastWorkoutDate).toBe('2024-01-05'); // untouched, not corrupted
    });

    it('restarts cleanly when the stored date is corrupt', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: 6, longestStreak: 12, lastWorkoutDate: 'not-a-date' }),
      );
      vi.setSystemTime(new Date(2024, 0, 3, 9, 0, 0));

      const data = updateWorkoutStreak();
      expect(data.currentStreak).toBe(1);
      expect(data.longestStreak).toBe(12); // lifetime best retained
      expect(data.lastWorkoutDate).toBe('2024-01-03');
    });
  });

  describe('storage failure handling', () => {
    it('returns defaults when localStorage contains corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json');
      const data = getWorkoutStreak();
      expect(data.currentStreak).toBe(0);
      expect(data.lastWorkoutDate).toBeNull();
    });

    it('returns defaults when the parsed value is not an object', () => {
      localStorage.setItem(STORAGE_KEY, '42');
      const data = getWorkoutStreak();
      expect(data.currentStreak).toBe(0);
      expect(data.lastWorkoutDate).toBeNull();
    });

    it('sanitizes non-finite or negative streak counters', () => {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ currentStreak: -3, longestStreak: 'nope', lastWorkoutDate: '2024-01-01' }),
      );
      const data = getWorkoutStreak();
      expect(data.currentStreak).toBe(0);
      expect(data.longestStreak).toBe(0);
      expect(data.lastWorkoutDate).toBe('2024-01-01');
    });

    it('returns defaults when localStorage.getItem itself throws', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      try {
        const data = getWorkoutStreak();
        expect(data.currentStreak).toBe(0);
        expect(data.lastWorkoutDate).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it('does not throw when localStorage.setItem throws (Safari private mode)', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      try {
        expect(() => updateWorkoutStreak()).not.toThrow();
        const data = updateWorkoutStreak();
        expect(data.currentStreak).toBe(1);
        expect(data.lastWorkoutDate).toBe('2024-01-01');
      } finally {
        spy.mockRestore();
      }
    });
  });
});
