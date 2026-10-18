import { describe, expect, it } from "vitest";
import { generateBowl } from "../src/tools/bowl/generate";

// Ground truth: Pear wood 5 sides' ReuleauxExteriorRoughing.svg contains a real
// id="Relief" path: radius 109.0, cutDepth -9mm, for these exact input parameters.
describe("foot relief pocket vs. real bowl output", () => {
  it("reproduces the real relief pocket's radius and cutDepth exactly", () => {
    const files = generateBowl({
      sides: 5,
      outerDiameter: 250,
      innerDiameter: 234,
      outerDepth: 60,
      innerDepth: 50,
      footHeight: 2,
      footDiameter: 125,
      zTouchHeight: 50,
      bitSize: 8,
      mmCut: 0.5,
      interiorModel: "circumferential",
      exteriorModel: "circumferential",
    });

    const roughing = files.find((f) => f.kind === "exterior-roughing")!;
    const match = roughing.content.match(/id="Relief"[\s\S]*?d="M [0-9.]+,[0-9.]+ A ([0-9.]+),[\s\S]*?shaper:cutDepth="(-?[0-9.]+)mm"/);
    expect(match).not.toBeNull();
    const [, radius, cutDepth] = match!;
    expect(parseFloat(radius)).toBeCloseTo(109.0, 2);
    expect(parseFloat(cutDepth)).toBeCloseTo(-9, 2);
  });

  it("omits the relief pocket when footRelief is explicitly disabled", () => {
    const files = generateBowl({
      sides: 5,
      outerDiameter: 250,
      innerDiameter: 234,
      outerDepth: 60,
      innerDepth: 50,
      footHeight: 2,
      footDiameter: 125,
      zTouchHeight: 50,
      bitSize: 8,
      mmCut: 0.5,
      interiorModel: "circumferential",
      exteriorModel: "circumferential",
      footRelief: false,
    });

    const roughing = files.find((f) => f.kind === "exterior-roughing")!;
    expect(roughing.content).not.toContain('id="Relief"');
  });
});
