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
  it("matches the fixed radial step near θ=0, where circumferential would cluster densely", () => {
    const radial = stepAngles(0, 90, mmCut, "radial", wideShallowCurve);
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    const circumferential = stepAngles(0, 90, mmCut, "circumferential", wideShallowCurve);

    // Confirm the premise: circumferential's very first step is much smaller than
    // radial's fixed step for this wide/shallow profile (the cluster this exists to avoid).
    expect(circumferential[1] - circumferential[0]).toBeLessThan((radial[1] - radial[0]) / 2);

    // Hybrid's early steps should match radial's fixed step size exactly (floored there).
    const radialStep = radial[1] - radial[0];
    for (let i = 0; i < 3; i++) {
      expect(hybrid[i + 1] - hybrid[i]).toBeCloseTo(radialStep, 6);
    }
  });

  it("produces meaningfully fewer total rings than pure circumferential for this shape", () => {
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    const circumferential = stepAngles(0, 90, mmCut, "circumferential", wideShallowCurve);
    expect(hybrid.length).toBeLessThan(circumferential.length);
  });

  it("never needs more total rings than pure radial, since every step is >= the radial floor", () => {
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    const radial = stepAngles(0, 90, mmCut, "radial", wideShallowCurve);
    expect(hybrid.length).toBeLessThanOrEqual(radial.length);
  });

  it("never takes a smaller step than radial's fixed step, except the final boundary-clamped one", () => {
    const hybrid = stepAngles(0, 90, mmCut, "hybrid", wideShallowCurve);
    const radial = stepAngles(0, 90, mmCut, "radial", wideShallowCurve);
    const radialStep = radial[1] - radial[0];

    // Exclude the last interval: it's clamped to land exactly on thetaEnd (90), so it
    // can legitimately be smaller than a full natural step — not a real violation.
    for (let i = 0; i < hybrid.length - 2; i++) {
      expect(hybrid[i + 1] - hybrid[i]).toBeGreaterThanOrEqual(radialStep - 1e-9);
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
});
