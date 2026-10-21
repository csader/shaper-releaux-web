import { describe, expect, it } from "vitest";
import { interiorProfile, stepAngles } from "../src/geometry/profile";

// Motivating case: the real job that prompted this — a wide, shallow circular
// interior pocket (~135mm diameter, ~12.7mm deep) where circumferential stepping
// packs a dense cluster of near-identical rings near θ=0, because dZ/dθ≈0 there (the
// profile is nearly flat/horizontal at the center) while dR/dθ is large (driven by
// the wide diameter) — see profile.ts's stepAngles doc comment.
const wideShallowCurve = interiorProfile(135.382, 12.7, 60, 60);
const mmCut = 0.25;

describe("hybrid stepping model", () => {
  it("every step's actual depth change is at least mmCut, unlike plain circumferential near θ=0", () => {
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    const circumferential = stepAngles(0, 90, mmCut, "circumferential", wideShallowCurve);

    // Confirm the premise: circumferential's very first step changes depth by much
    // less than mmCut (the cluster this exists to avoid).
    const circFirstZDelta = Math.abs(
      wideShallowCurve(circumferential[1]).Z - wideShallowCurve(circumferential[0]).Z,
    );
    expect(circFirstZDelta).toBeLessThan(mmCut / 10);

    // Every hybrid step (except possibly the last, boundary-clamped one) should hit
    // the mmCut depth target almost exactly, via bisection.
    for (let i = 0; i < hybrid.length - 2; i++) {
      const zDelta = Math.abs(wideShallowCurve(hybrid[i + 1]).Z - wideShallowCurve(hybrid[i]).Z);
      expect(zDelta).toBeCloseTo(mmCut, 3);
    }
  });

  it("step size shrinks smoothly step-to-step, not in one blunt jump", () => {
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    // Each step should be noticeably smaller than the previous one, not identical
    // (that'd suggest it degenerated into a fixed-angle/radial-like model) and not a
    // single wild jump straight to the far end (the regression this guards against —
    // a naive linear correction overshot the very first step to theta=90 outright,
    // since dZ/dθ=0 exactly at θ=0 makes Z locally quadratic, not linear, in step size).
    for (let i = 1; i < Math.min(5, hybrid.length - 1); i++) {
      const prevStep = hybrid[i] - hybrid[i - 1];
      const step = hybrid[i + 1] - hybrid[i];
      expect(step).toBeLessThan(prevStep);
      expect(step).toBeGreaterThan(prevStep * 0.1);
    }
    expect(hybrid[1]).toBeLessThan(45); // nowhere near thetaEnd on the first step
  });

  it("produces meaningfully fewer total rings than pure circumferential for this shape", () => {
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    const circumferential = stepAngles(0, 90, mmCut, "circumferential", wideShallowCurve);
    expect(hybrid.length).toBeLessThan(circumferential.length);
  });

  it("never takes a smaller step than circumferential would at the same point", () => {
    // Hybrid only ever grows a step relative to circumferential's own choice at that
    // theta, never shrinks it — so hybrid can't be finer than circumferential
    // anywhere, only coarser where depth isn't moving fast enough.
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    for (let i = 0; i < hybrid.length - 1; i++) {
      const hybridStep = hybrid[i + 1] - hybrid[i];
      const circFromHere = stepAngles(hybrid[i], 90, mmCut, "circumferential", wideShallowCurve);
      const circStepFromHere = circFromHere[1] - circFromHere[0];
      expect(hybridStep).toBeGreaterThanOrEqual(circStepFromHere - 1e-6);
    }
  });

  it("still starts and ends at thetaStart/thetaEnd", () => {
    const hybrid = stepAngles(5, 90, mmCut, "hybrid", wideShallowCurve);
    expect(hybrid[0]).toBeCloseTo(5, 6);
    expect(hybrid[hybrid.length - 1]).toBeCloseTo(90, 6);
  });

  it("returns a single point when thetaEnd <= thetaStart, like the other models", () => {
    expect(stepAngles(10, 10, mmCut, "hybrid", wideShallowCurve)).toEqual([10]);
    expect(stepAngles(10, 5, mmCut, "hybrid", wideShallowCurve)).toEqual([10]);
  });

  it("doesn't throw or hang on a flat (constant-depth) curve segment", () => {
    const flatCurve = (theta: number) => ({ R: theta, Z: 5 }); // Z never changes at all
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", flatCurve);
    expect(hybrid[0]).toBe(0);
    expect(hybrid[hybrid.length - 1]).toBe(90);
    expect(hybrid.every(Number.isFinite)).toBe(true);
  });
});
