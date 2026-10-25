import { describe, expect, it } from "vitest";
import { buildExteriorCurve, buildInteriorCurve, exteriorStartFor, generateBowl } from "../src/tools/bowl/generate";

const baseParams = {
  sides: 1 as const,
  outerDiameter: 200,
  innerDiameter: 180,
  outerDepth: 60,
  innerDepth: 50,
  footHeight: 2,
  footDiameter: 100,
  zTouchHeight: 60,
  bitSize: 8,
  mmCut: 1,
  interiorModel: "circumferential" as const,
  exteriorModel: "circumferential" as const,
};

describe("buildInteriorCurve / buildExteriorCurve (extracted for the cross-section preview)", () => {
  it("buildInteriorCurve matches the depths generateBowl's own finishing rings actually use", () => {
    const curve = buildInteriorCurve(baseParams);
    const files = generateBowl(baseParams);
    const finishing = files.find((f) => f.kind === "interior")!;
    const ids = [...finishing.content.matchAll(/id="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    const depths = [...finishing.content.matchAll(/shaper:cutDepth="(-?[\d.]+)mm"/g)].map((m) => parseFloat(m[1]));
    for (let i = 0; i < ids.length; i++) {
      // ids are theta rounded to 2dp for display, so re-evaluating the curve at that
      // rounded theta drifts slightly from the depth computed at the true theta.
      expect(curve(ids[i]).Z).toBeCloseTo(depths[i], 1);
    }
  });

  it("buildExteriorCurve matches the depths generateBowl's own finishing rings actually use", () => {
    const curve = buildExteriorCurve(baseParams);
    const files = generateBowl(baseParams);
    const finishing = files.find((f) => f.kind === "exterior")!;
    const ids = [...finishing.content.matchAll(/id="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    const depths = [...finishing.content.matchAll(/shaper:cutDepth="(-?[\d.]+)mm"/g)].map((m) => parseFloat(m[1]));
    for (let i = 0; i < ids.length; i++) {
      // ids are theta rounded to 2dp for display, so re-evaluating the curve at that
      // rounded theta drifts slightly from the depth computed at the true theta.
      expect(curve(ids[i]).Z).toBeCloseTo(depths[i], 1);
    }
  });

  it("exteriorStartFor returns 0 for a custom exterior profile, the foot angle otherwise", () => {
    expect(exteriorStartFor(baseParams)).toBeGreaterThan(0);
    expect(
      exteriorStartFor({ ...baseParams, customExteriorProfile: { points: [{ r: 0, z: 0 }, { r: 1, z: 1 }] } }),
    ).toBe(0);
  });

  it("buildInteriorCurve respects interiorProfileShape and flatBottomDiameter", () => {
    const circular = buildInteriorCurve({ ...baseParams, interiorProfileShape: "circular" });
    const elliptical = buildInteriorCurve(baseParams);
    expect(circular(45).Z).not.toBeCloseTo(elliptical(45).Z, 1);

    const flatBottom = buildInteriorCurve({ ...baseParams, flatBottomDiameter: 40 });
    expect(flatBottom(0).R).toBeCloseTo(40, 3);
  });
});
