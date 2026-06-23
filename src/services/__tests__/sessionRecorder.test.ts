import { describe, it, expect } from "vitest";
import { RLDCompressionDriver } from "../sessionRecorder";
import type { CompressedFrameChunk } from "../sessionRecorder";

const baseChunk = (): CompressedFrameChunk => ({
  kind: "base",
  timestamp: 0,
  timestampDelta: 33,
  runLength: 1,
  exercise: "squat",
  feedback: "good",
  angles: { knee: 90 },
  landmarks: [{ x: 0, y: 0, z: 0, visibility: 1 }],
});

describe("RLDCompressionDriver.decompress", () => {
  it("decompresses a single base chunk into one frame", () => {
    const frames = RLDCompressionDriver.decompress([baseChunk()]);
    expect(frames).toHaveLength(1);
    expect(frames[0].exercise).toBe("squat");
    expect(frames[0].feedback).toBe("good");
  });

  it("expands a chunk with runLength into the expected number of frames", () => {
    const chunk = baseChunk();
    chunk.runLength = 50;
    const frames = RLDCompressionDriver.decompress([chunk]);
    expect(frames).toHaveLength(50);
  });

  it("caps total frames when a single chunk reports a huge runLength", () => {
    const chunk = baseChunk();
    chunk.runLength = 5_000_000;
    const frames = RLDCompressionDriver.decompress([chunk]);
    expect(frames.length).toBeLessThanOrEqual(100000);
    expect(frames.length).toBeGreaterThan(0);
  });

  it("caps total frames when many small chunks together would exceed the bound", () => {
    const chunks: CompressedFrameChunk[] = [];
    for (let i = 0; i < 200000; i++) {
      chunks.push(baseChunk());
    }
    const frames = RLDCompressionDriver.decompress(chunks);
    expect(frames.length).toBeLessThanOrEqual(100000);
  });

  it("returns an empty array for empty input", () => {
    expect(RLDCompressionDriver.decompress([])).toEqual([]);
  });
});
