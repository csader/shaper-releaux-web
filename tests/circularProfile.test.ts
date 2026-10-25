import { describe, expect, it } from "vitest";
import { circularInteriorProfile } from "../src/geometry/circularProfile";
import { interiorProfile } from "../src/geometry/profile";

describe("circularInteriorProfile", () => {
  const innerDiameter = 234;
  const innerDepth = 50;
  const outerDepth = 60;
  const zTouchHeight = 60; // offset = 0, for simplicity

  it("starts at the center (R=0) at the full depth, at theta=0", () => {
    const curve = circularInteriorProfile(innerDiameter, innerDepth, outerDepth, zTouchHeight);
    const { R, Z } = curve(0);
    expect(R).toBeCloseTo(0, 6);
    expect(Z).toBeCloseTo(innerDepth, 6);
  });

  it("reaches the rim (R=full innerDiameter, matching interiorDiameter's own convention) at zero depth, at theta=90", () => {
    const curve = circularInteriorProfile(innerDiameter, innerDepth, outerDepth, zTouchHeight);
    const { R, Z } = curve(90);
    expect(R).toBeCloseTo(innerDiameter, 3);
    expect(Z).toBeCloseTo(0, 3);
  });

  it("R increases and Z decreases monotonically from center to rim", () => {
    const curve = circularInteriorProfile(innerDiameter, innerDepth, outerDepth, zTouchHeight);
    const samples = [0, 15, 30, 45, 60, 75, 90].map((t) => curve(t));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].R).toBeGreaterThan(samples[i - 1].R);
      expect(samples[i].Z).toBeLessThan(samples[i - 1].Z);
    }
  });

  it("applies the zTouch offset the same way the elliptical profile does", () => {
    const offsetHeight = 55; // outerDepth - zTouchHeight = 5
    const curve = circularInteriorProfile(innerDiameter, innerDepth, outerDepth, offsetHeight);
    const ellipse = interiorProfile(innerDiameter, innerDepth, outerDepth, offsetHeight);
    expect(curve(0).Z).toBeCloseTo(ellipse(0).Z, 6);
    expect(curve(90).Z).toBeCloseTo(ellipse(90).Z, 6);
  });

  it("produces a genuinely different shape from the elliptical profile at intermediate angles", () => {
    const circular = circularInteriorProfile(innerDiameter, innerDepth, outerDepth, zTouchHeight);
    const ellipse = interiorProfile(innerDiameter, innerDepth, outerDepth, zTouchHeight);
    const cMid = circular(45);
    const eMid = ellipse(45);
    // Same R isn't guaranteed at the same theta between the two parametrizations, but
    // the actual curve shape (Z as a function of R) should differ meaningfully.
    expect(Math.abs(cMid.Z - eMid.Z)).toBeGreaterThan(0.5);
  });

  it("doesn't produce NaN/Infinity for a degenerate zero-depth input", () => {
    const curve = circularInteriorProfile(innerDiameter, 0, outerDepth, zTouchHeight);
    for (const t of [0, 30, 60, 90]) {
      const { R, Z } = curve(t);
      expect(Number.isFinite(R)).toBe(true);
      expect(Number.isFinite(Z)).toBe(true);
    }
  });

  it("handles the hemisphere limit (innerDepth == halfWidth) without NaN", () => {
    const curve = circularInteriorProfile(100, 50, outerDepth, zTouchHeight);
    const { R, Z } = curve(90);
    expect(Number.isFinite(R)).toBe(true);
    expect(Number.isFinite(Z)).toBe(true);
    expect(R).toBeCloseTo(100, 3);
    expect(Z).toBeCloseTo(0, 3);
  });
});
