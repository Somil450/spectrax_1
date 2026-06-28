import { describe, it, expect } from 'vitest';
import { calculateLevel } from '../useLeveling';

describe('calculateLevel', () => {
  it('returns level 1 for NaN or negative xp (guards against NaN poisoning)', () => {
    expect(calculateLevel(NaN)).toBe(1);
    expect(calculateLevel(-50)).toBe(1);
    expect(calculateLevel(Infinity - Infinity)).toBe(1);
  });

  it('maps xp to the correct level for valid values', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(150)).toBe(2);
    expect(calculateLevel(8000)).toBe(8);
    expect(calculateLevel(13000)).toBe(9);
  });
});
