import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWorkoutStreak, updateWorkoutStreak } from '../streakUtils';

describe('streakUtils', () => {
  const STORAGE_KEY = 'spectrax_workout_streak';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getWorkoutStreak', () => {
    it('should return default values when no data is in localStorage', () => {
      const data = getWorkoutStreak();
      expect(data).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: null,
      });
    });

    it('should return saved data from localStorage', () => {
      const mockData = {
        currentStreak: 5,
        longestStreak: 10,
        lastWorkoutDate: 'Mon Jan 01 2024',
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mockData));

      const data = getWorkoutStreak();
      expect(data).toEqual(mockData);
    });
  });

  describe('updateWorkoutStreak', () => {
    it('should initialize streak on first workout', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data).toEqual({
        currentStreak: 1,
        longestStreak: 1,
        lastWorkoutDate: new Date('2024-01-01T12:00:00Z').toDateString(),
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
      expect(data.lastWorkoutDate).toBe(initialDate.toDateString());
    });

    it('should increment streak if working out on the next consecutive day', () => {
      // Day 1
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      updateWorkoutStreak();

      // Day 2
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data.currentStreak).toBe(2);
      expect(data.longestStreak).toBe(2);
      expect(data.lastWorkoutDate).toBe(new Date('2024-01-02T12:00:00Z').toDateString());
    });

    it('should reset streak if a day is skipped', () => {
      // Day 1
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
      updateWorkoutStreak();

      // Day 2
      vi.setSystemTime(new Date('2024-01-02T12:00:00Z'));
      updateWorkoutStreak();

      // Day 4 (skipped Day 3)
      vi.setSystemTime(new Date('2024-01-04T12:00:00Z'));
      const data = updateWorkoutStreak();

      expect(data.currentStreak).toBe(1);
      expect(data.longestStreak).toBe(2); // Retains longest streak
      expect(data.lastWorkoutDate).toBe(new Date('2024-01-04T12:00:00Z').toDateString());
    });
  });

  describe('storage failure handling', () => {
    it('returns defaults when localStorage contains corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json');
      const data = getWorkoutStreak();
      expect(data).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: null,
      });
    });

    it('returns defaults when the parsed value is not an object', () => {
      localStorage.setItem(STORAGE_KEY, '42');
      const data = getWorkoutStreak();
      expect(data).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        lastWorkoutDate: null,
      });
    });

    it('returns defaults when localStorage.getItem itself throws', () => {
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      try {
        const data = getWorkoutStreak();
        expect(data).toEqual({
          currentStreak: 0,
          longestStreak: 0,
          lastWorkoutDate: null,
        });
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
        expect(data.lastWorkoutDate).toBe(new Date('2024-01-01T12:00:00Z').toDateString());
      } finally {
        spy.mockRestore();
      }
    });
  });
});
