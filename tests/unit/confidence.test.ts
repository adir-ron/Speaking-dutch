import { describe, it, expect } from "vitest";
import { smoothedRate, updateConfidence } from "@/lib/confidence";

describe("smoothedRate", () => {
  it("returns 0.5 for zero data (prior)", () => {
    expect(smoothedRate(0, 0)).toBeCloseTo(0.5);
  });

  it("does not return 1.0 for 1/1 (avoids mastery bug)", () => {
    const rate = smoothedRate(1, 1);
    expect(rate).toBeCloseTo(0.6);
    expect(rate).toBeLessThan(1.0);
  });

  it("returns ~0.78 for 5/5", () => {
    expect(smoothedRate(5, 5)).toBeCloseTo(0.778, 2);
  });

  it("returns ~0.22 for 0/5", () => {
    expect(smoothedRate(0, 5)).toBeCloseTo(0.222, 2);
  });

  it("returns ~0.33 for 0/2", () => {
    expect(smoothedRate(0, 2)).toBeCloseTo(0.333, 2);
  });

  it("handles large numbers", () => {
    const rate = smoothedRate(95, 100);
    expect(rate).toBeGreaterThan(0.9);
    expect(rate).toBeLessThan(1.0);
  });
});

describe("updateConfidence", () => {
  it("does not change confidence when attempts is 0", () => {
    expect(updateConfidence(0.5, 0, 0)).toBe(0.5);
    expect(updateConfidence(0.8, 3, 0)).toBe(0.8);
  });

  it("does not change confidence when attempts is negative", () => {
    expect(updateConfidence(0.5, 0, -1)).toBe(0.5);
  });

  it("blends old and new confidence with 60/40 weight", () => {
    const result = updateConfidence(0.5, 1, 1);
    // smoothedRate(1,1) = 0.6, new = 0.6*0.5 + 0.4*0.6 = 0.3 + 0.24 = 0.54
    expect(result).toBeCloseTo(0.54);
  });

  it("increases confidence on good performance", () => {
    const result = updateConfidence(0.3, 4, 5);
    expect(result).toBeGreaterThan(0.3);
  });

  it("decreases confidence on poor performance", () => {
    const result = updateConfidence(0.8, 0, 5);
    expect(result).toBeLessThan(0.8);
  });
});
