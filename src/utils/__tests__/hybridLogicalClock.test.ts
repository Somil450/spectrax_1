import { describe, it, expect } from 'vitest';
import { hlcFromString } from '../hybridLogicalClock';

describe('hlcFromString', () => {
  it('parses a valid HLC string', () => {
    const hlc = hlcFromString('1700000000000:5:node-a');
    expect(hlc.wallTime).toBe(1700000000000);
    expect(hlc.counter).toBe(5);
    expect(hlc.nodeId).toBe('node-a');
  });

  it('returns finite numbers (not NaN) for a malformed string', () => {
    const hlc = hlcFromString('garbage');
    expect(Number.isFinite(hlc.wallTime)).toBe(true);
    expect(Number.isFinite(hlc.counter)).toBe(true);
  });

  it('preserves a nodeId that contains colons', () => {
    const hlc = hlcFromString('100:2:node:with:colons');
    expect(hlc.wallTime).toBe(100);
    expect(hlc.counter).toBe(2);
    expect(hlc.nodeId).toBe('node:with:colons');
  });
});
