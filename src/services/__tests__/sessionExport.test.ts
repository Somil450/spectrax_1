import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  escapeCsvField,
  toCsvLine,
  buildSessionJson,
  buildSessionCsv,
  downloadSessionData,
  ExportableSessionStats,
} from '../sessionExportService';
import { FrameData } from '../sessionRecorder';

const stats: ExportableSessionStats = {
  exerciseName: 'squat',
  reps: 12,
  totalReps: 14,
  correctReps: 12,
  repScores: [92, 88, 95],
  repDeviations: [1.5, 2.1, 0.8],
  duration: 180,
  accuracy: 85,
  mistakes: { kneePastToes: 3, backArch: 1 },
  bestStreak: 8,
  tags: ['compound', 'strength'],
  calories: 42,
  gainedXp: 30,
};

const frames: FrameData[] = [
  {
    timestamp: 1000,
    landmarks: [
      { x: 0.1, y: 0.2, z: 0.01, visibility: 0.99 },
      { x: 0.3, y: 0.4, z: 0.02, visibility: 0.95 },
    ],
    angles: { knee: 90 },
    feedback: 'ok',
    exercise: 'squat',
  },
  {
    timestamp: 1500,
    landmarks: [
      { x: 0.12, y: 0.21, z: 0.01, visibility: 0.99 },
      { x: 0.31, y: 0.41, z: 0.02, visibility: 0.96 },
    ],
    angles: { knee: 88 },
    feedback: 'good',
    exercise: 'squat',
  },
];

describe('escapeCsvField', () => {
  it('passes through simple values', () => {
    expect(escapeCsvField('squat')).toBe('squat');
    expect(escapeCsvField(42)).toBe('42');
    expect(escapeCsvField(null)).toBe('');
    expect(escapeCsvField(undefined)).toBe('');
  });

  it('quotes fields containing commas, quotes or newlines', () => {
    expect(escapeCsvField('knee,past')).toBe('"knee,past"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
  });
});

describe('toCsvLine', () => {
  it('joins fields with commas and CRLF', () => {
    expect(toCsvLine(['a', 1, 'b,c'])).toBe('a,1,"b,c"\r\n');
  });
});

describe('buildSessionJson', () => {
  it('produces a well-structured session object', () => {
    const json = buildSessionJson(stats);
    expect(json.format).toBe('spectrax-session-export');
    expect(json.version).toBe(1);
    expect(json.session.exerciseName).toBe('squat');
    expect(json.session.accuracy).toBe(85);
    expect(json.reps).toEqual([
      { index: 0, score: 92, deviation: 1.5 },
      { index: 1, score: 88, deviation: 2.1 },
      { index: 2, score: 95, deviation: 0.8 },
    ]);
  });

  it('serializes to valid JSON', () => {
    const json = buildSessionJson(stats);
    expect(() => JSON.parse(JSON.stringify(json))).not.toThrow();
  });

  it('includes coordinate logs when frames are provided', () => {
    const json = buildSessionJson(stats, frames);
    expect(json.coordinates).toHaveLength(2);
    expect(json.coordinates[0].landmarks).toHaveLength(2);
    expect(json.coordinates[1].timeMs).toBe(1500);
  });

  it('omits coordinates when no frames are available', () => {
    const json = buildSessionJson(stats, undefined);
    expect(json.coordinates).toHaveLength(0);
  });

  it('caps coordinate frames with maxCoordinateFrames', () => {
    const json = buildSessionJson(stats, frames, { includeCoordinates: true, maxCoordinateFrames: 1 });
    expect(json.coordinates).toHaveLength(1);
  });
});

describe('buildSessionCsv', () => {
  it('contains session, reps and mistakes sections', () => {
    const csv = buildSessionCsv(stats);
    expect(csv).toContain('[SESSION]');
    expect(csv).toContain('[REPS]');
    expect(csv).toContain('[MISTAKES]');
    expect(csv).toContain('exerciseName,durationSeconds');
    expect(csv).toContain('kneePastToes,3');
    expect(csv).not.toContain('[COORDINATES]');
  });

  it('writes one rep row per score with CRLF endings', () => {
    const csv = buildSessionCsv(stats);
    const rows = csv.trim().split('\r\n');
    expect(rows.some((r) => r.startsWith('0,92,1.5'))).toBe(true);
    expect(rows.some((r) => r.startsWith('1,88,2.1'))).toBe(true);
  });

  it('includes coordinate rows when frames are provided', () => {
    const csv = buildSessionCsv(stats, frames);
    expect(csv).toContain('[COORDINATES]');
    expect(csv).toContain('frameIndex,timeMs,landmarkIndex,x,y,z,visibility');
    expect(csv).toContain('0,1000,0,0.1,0.2,0.01,0.99');
    expect(csv).toContain('1,1500,1,0.31,0.41,0.02,0.96');
  });

  it('respects the coordinate frame cap', () => {
    const csv = buildSessionCsv(stats, frames, { includeCoordinates: true, maxCoordinateFrames: 1 });
    expect(csv).not.toContain('1,1500,0,');
  });

  it('escapes mistake categories containing special characters', () => {
    const tricky = { ...stats, mistakes: { 'knee,past,toes': 2 } };
    const csv = buildSessionCsv(tricky);
    expect(csv).toContain('"knee,past,toes",2');
  });
});

describe('downloadSessionData', () => {
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    });
    document.createElement = vi.fn(() => ({
      href: '',
      download: '',
      click: vi.fn(),
    })) as any;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('downloads a .json file with the session payload', () => {
    let link: any;
    document.createElement = vi.fn(() => {
      link = { href: '', download: '', click: vi.fn() };
      return link;
    }) as any;
    downloadSessionData(stats, 'json');
    expect(link.download).toMatch(/^workout-session-.*\.json$/);
    expect(link.click).toHaveBeenCalled();
  });

  it('downloads a .csv file with a UTF-8 BOM prefix', () => {
    let captured: Blob | null = null;
    const origBlob = globalThis.Blob;
    globalThis.Blob = class extends origBlob {
      constructor(parts: BlobPart[], opts?: BlobPropertyBag) {
        super(parts, opts);
        captured = new origBlob(parts, opts);
      }
    } as any;

    let link: any;
    document.createElement = vi.fn(() => {
      link = { href: '', download: '', click: vi.fn() };
      return link;
    }) as any;

    downloadSessionData(stats, 'csv');
    expect(link.download).toMatch(/^workout-session-.*\.csv$/);
    expect(link.click).toHaveBeenCalled();
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock');

    globalThis.Blob = origBlob;
    void captured;
  });
});
