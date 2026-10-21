import { describe, expect, it } from "vitest";
import { generateBowl } from "../src/tools/bowl/generate";
import type { CustomProfile } from "../src/geometry/customProfile";

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

// A flatter-bottomed, steeper-walled profile than the default ellipse — deep near the
// center/foot, dropping off quickly as r increases, in contrast to the smooth
// quarter-ellipse the parametric formula always produces.
const parabolaLike: CustomProfile = {
  points: [
    { r: 0, z: 1 },
    { r: 0.5, z: 0.9 },
    { r: 0.85, z: 0.4 },
    { r: 1, z: 0 },
  ],
};

describe("custom interior profile", () => {
  it("produces finishing rings with monotonically decreasing depth from center to rim", () => {
    const files = generateBowl({ ...baseParams, customInteriorProfile: parabolaLike });
    const finishing = files.find((f) => f.kind === "interior")!;
    const depths = [...finishing.content.matchAll(/shaper:cutDepth="(-?[\d.]+)mm"/g)].map((m) => parseFloat(m[1]));
    expect(depths.length).toBeGreaterThan(5);
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i]).toBeLessThanOrEqual(depths[i - 1] + 1e-6);
    }
  });

  it("differs from the default parametric (elliptical) profile's ring diameters at the same depth step", () => {
    const custom = generateBowl({ ...baseParams, customInteriorProfile: parabolaLike });
    const parametric = generateBowl({ ...baseParams });
    const customD = custom.find((f) => f.kind === "interior")!.content;
    const parametricD = parametric.find((f) => f.kind === "interior")!.content;
    expect(customD).not.toBe(parametricD);
  });
});

describe("custom exterior profile — foot becomes optional", () => {
  it("omits the foot relief pocket from exterior roughing", () => {
    const files = generateBowl({ ...baseParams, customExteriorProfile: parabolaLike, footRelief: true });
    const roughing = files.find((f) => f.kind === "exterior-roughing")!;
    expect(roughing.content).not.toContain('id="Relief"');
  });

  it("still includes the relief pocket for a parametric exterior (unaffected)", () => {
    const files = generateBowl({ ...baseParams, footRelief: true });
    const roughing = files.find((f) => f.kind === "exterior-roughing")!;
    expect(roughing.content).toContain('id="Relief"');
  });

  it("omits Foot Height/Foot Diameter from the file comments", () => {
    const files = generateBowl({ ...baseParams, customExteriorProfile: parabolaLike });
    const exterior = files.find((f) => f.kind === "exterior")!;
    expect(exterior.content).not.toContain("Foot Height");
    expect(exterior.content).not.toContain("Foot Diameter");
  });

  it("finishing pass starts at theta=0, not the parametric foot angle", () => {
    const files = generateBowl({ ...baseParams, customExteriorProfile: parabolaLike });
    const exterior = files.find((f) => f.kind === "exterior")!;
    const ids = [...exterior.content.matchAll(/id="([\d.]+)"/g)].map((m) => parseFloat(m[1]));
    expect(Math.min(...ids)).toBeLessThan(5); // well below any typical footAngle
  });

  it("produces monotonically increasing depth from start to rim (shallow near center/foot, deep at rim)", () => {
    // Drawn the way a real exterior curve would be: shallow near the foot (z=0 at
    // r=0), deep at the rim (z=1 at r=1) — the opposite direction from parabolaLike,
    // which is an interior-shaped (deep-at-center) curve.
    const exteriorShaped: CustomProfile = {
      points: [
        { r: 0, z: 0 },
        { r: 0.5, z: 0.1 },
        { r: 0.85, z: 0.6 },
        { r: 1, z: 1 },
      ],
    };
    const files = generateBowl({ ...baseParams, customExteriorProfile: exteriorShaped });
    const finishing = files.find((f) => f.kind === "exterior")!;
    const depths = [...finishing.content.matchAll(/shaper:cutDepth="(-?[\d.]+)mm"/g)].map((m) => parseFloat(m[1]));
    expect(depths.length).toBeGreaterThan(5);
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i]).toBeGreaterThanOrEqual(depths[i - 1] - 1e-6);
    }
  });
});

describe("both surfaces custom at once", () => {
  it("generates all files without error, machining two-sided", () => {
    const files = generateBowl({
      ...baseParams,
      customInteriorProfile: parabolaLike,
      customExteriorProfile: parabolaLike,
    });
    expect(files.length).toBeGreaterThan(0);
    expect(files.some((f) => f.kind === "interior")).toBe(true);
    expect(files.some((f) => f.kind === "exterior")).toBe(true);
  });
});
