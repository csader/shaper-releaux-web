import { describe, expect, it } from "vitest";
import { evaluateCustomProfile, toProfileCurve, type CustomProfile } from "../src/geometry/customProfile";

describe("evaluateCustomProfile", () => {
  it("passes through each control point exactly, at the expected t fraction", () => {
    const profile: CustomProfile = {
      points: [
        { r: 0, z: 1 },
        { r: 0.3, z: 0.7 },
        { r: 0.6, z: 0.4 },
        { r: 1, z: 0 },
      ],
    };
    const n = profile.points.length;
    profile.points.forEach((p, i) => {
      const t = i / (n - 1);
      const result = evaluateCustomProfile(profile, t);
      expect(result.r).toBeCloseTo(p.r, 10);
      expect(result.z).toBeCloseTo(p.z, 10);
    });
  });

  it("interpolates a straight line exactly between two points", () => {
    const profile: CustomProfile = { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] };
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const result = evaluateCustomProfile(profile, t);
      expect(result.r).toBeCloseTo(t, 10);
      expect(result.z).toBeCloseTo(1 - t, 10);
    }
  });

  it("never overshoots a monotonic z sequence, even with unevenly spaced points", () => {
    // A classic Catmull-Rom spline (no monotonicity correction) can overshoot past an
    // endpoint value between two control points when spacing is uneven — this is the
    // exact failure mode the Fritsch-Carlson correction exists to prevent, since an
    // overshoot here would describe a physically uncuttable undercut.
    const profile: CustomProfile = {
      points: [
        { r: 0, z: 1 },
        { r: 0.05, z: 0.9 },
        { r: 0.9, z: 0.1 },
        { r: 1, z: 0 },
      ],
    };
    let prevZ = Infinity;
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const { z } = evaluateCustomProfile(profile, t);
      expect(z).toBeLessThanOrEqual(prevZ + 1e-9);
      expect(z).toBeGreaterThanOrEqual(-1e-9);
      expect(z).toBeLessThanOrEqual(1 + 1e-9);
      prevZ = z;
    }
  });

  it("clamps t outside [0,1] to the endpoints", () => {
    const profile: CustomProfile = { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] };
    expect(evaluateCustomProfile(profile, -1)).toEqual(evaluateCustomProfile(profile, 0));
    expect(evaluateCustomProfile(profile, 2)).toEqual(evaluateCustomProfile(profile, 1));
  });

  it("handles a single point (degenerate case) without throwing", () => {
    const profile: CustomProfile = { points: [{ r: 0.5, z: 0.5 }] };
    expect(evaluateCustomProfile(profile, 0)).toEqual({ r: 0.5, z: 0.5 });
    expect(evaluateCustomProfile(profile, 1)).toEqual({ r: 0.5, z: 0.5 });
  });
});

describe("toProfileCurve", () => {
  it("scales normalized r/z to real mm, with the depth offset applied", () => {
    const profile: CustomProfile = { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] };
    const curve = toProfileCurve(profile, /* maxDiameter */ 200, /* maxDepth */ 50, /* offset */ 0);
    const atCenter = curve(0);
    expect(atCenter.R).toBeCloseTo(0, 6);
    expect(atCenter.Z).toBeCloseTo(50, 6);
    const atRim = curve(90);
    expect(atRim.R).toBeCloseTo(200, 6);
    expect(atRim.Z).toBeCloseTo(0, 6);
  });

  it("subtracts the offset term, matching the parametric formulas' Z-touch convention", () => {
    const profile: CustomProfile = { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] };
    const curve = toProfileCurve(profile, 200, 50, 10);
    expect(curve(0).Z).toBeCloseTo(40, 6); // 1*50 - 10
    expect(curve(90).Z).toBeCloseTo(-10, 6); // 0*50 - 10
  });

  it("samples mid-curve points consistently with evaluateCustomProfile", () => {
    const profile: CustomProfile = {
      points: [{ r: 0, z: 1 }, { r: 0.5, z: 0.6 }, { r: 1, z: 0 }],
    };
    const curve = toProfileCurve(profile, 100, 20, 0);
    const mid = curve(45); // theta=45 -> t=0.5 -> the middle control point exactly
    expect(mid.R).toBeCloseTo(50, 6);
    expect(mid.Z).toBeCloseTo(12, 6); // 0.6*20
  });
});
