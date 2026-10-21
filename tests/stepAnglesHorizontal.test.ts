import { describe, expect, it } from "vitest";
import { interiorProfile, stepAngles } from "../src/geometry/profile";

// Same wide/shallow curve used for the hybrid model's tests — a good case for
// horizontal too, since the author recommends it specifically for wide/shallow shapes.
const wideShallowCurve = interiorProfile(135.382, 12.7, 60, 60);
const mmCut = 0.25;

describe("horizontal stepping model", () => {
  it("every step's actual radius change is mmCut (except possibly the last)", () => {
    const horizontal = stepAngles(0, 90, mmCut, "horizontal", wideShallowCurve);
    for (let i = 0; i < horizontal.length - 2; i++) {
      const rDelta = Math.abs(wideShallowCurve(horizontal[i + 1]).R - wideShallowCurve(horizontal[i]).R);
      expect(rDelta).toBeCloseTo(mmCut, 3);
    }
  });

  it("the final step never overshoots thetaEnd", () => {
    const horizontal = stepAngles(0, 90, mmCut, "horizontal", wideShallowCurve);
    const lastRDelta = Math.abs(
      wideShallowCurve(horizontal[horizontal.length - 1]).R -
        wideShallowCurve(horizontal[horizontal.length - 2]).R,
    );
    expect(lastRDelta).toBeLessThanOrEqual(mmCut + 1e-6);
  });

  it("still starts and ends at thetaStart/thetaEnd", () => {
    const horizontal = stepAngles(5, 90, mmCut, "horizontal", wideShallowCurve);
    expect(horizontal[0]).toBeCloseTo(5, 6);
    expect(horizontal[horizontal.length - 1]).toBeCloseTo(90, 6);
  });

  it("returns a single point when thetaEnd <= thetaStart, like the other models", () => {
    expect(stepAngles(10, 10, mmCut, "horizontal", wideShallowCurve)).toEqual([10]);
    expect(stepAngles(10, 5, mmCut, "horizontal", wideShallowCurve)).toEqual([10]);
  });

  it("produces monotonically increasing angles", () => {
    const horizontal = stepAngles(0, 90, mmCut, "horizontal", wideShallowCurve);
    for (let i = 1; i < horizontal.length; i++) {
      expect(horizontal[i]).toBeGreaterThan(horizontal[i - 1]);
    }
  });

  it("widens its angle step as the wall steepens near the lip, opposite of circumferential", () => {
    const horizontal = stepAngles(0, 90, mmCut, "horizontal", wideShallowCurve);
    const circumferential = stepAngles(0, 90, mmCut, "circumferential", wideShallowCurve);
    // Near the lip (profile steepens: dR/dθ shrinks relative to dZ/dθ), a constant-R
    // step needs a bigger Δθ than a constant-arc-length step does.
    const horizontalLastStep = horizontal[horizontal.length - 1] - horizontal[horizontal.length - 2];
    const circLastStep = circumferential[circumferential.length - 1] - circumferential[circumferential.length - 2];
    expect(horizontalLastStep).toBeGreaterThan(circLastStep);
  });
});
