import { describe, it, expect } from "vitest";
import { safeUniform } from "../safeUniform";

describe("safeUniform", () => {
  it("passes finite values within range through unchanged", () => {
    expect(safeUniform(0.5)).toBe(0.5);
    expect(safeUniform(0)).toBe(0);
    expect(safeUniform(1)).toBe(1);
  });

  it("clamps values below the minimum", () => {
    expect(safeUniform(-0.2)).toBe(0);
  });

  it("clamps values above the maximum", () => {
    expect(safeUniform(1.5)).toBe(1);
  });

  it("honours custom min/max bounds", () => {
    expect(safeUniform(4, 0, Math.PI)).toBeCloseTo(Math.PI, 5);
    expect(safeUniform(-1, 0, Math.PI)).toBe(0);
    expect(safeUniform(1.5, 0, Math.PI)).toBeCloseTo(1.5, 5);
  });

  it("replaces NaN with the fallback", () => {
    expect(safeUniform(NaN)).toBe(0);
    expect(safeUniform(NaN, 0, 1, 0.5)).toBe(0.5);
  });

  it("replaces Infinity/-Infinity with the fallback", () => {
    expect(safeUniform(Infinity)).toBe(0);
    expect(safeUniform(-Infinity, 0, 1, 0.25)).toBe(0.25);
  });
});
