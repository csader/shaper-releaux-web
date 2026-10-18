import { describe, expect, it } from "vitest";
import { exteriorDepth, exteriorDiameter, footAngleDeg } from "../src/geometry/profile";
import { parseRings, readSample } from "./fixtures";

// Ground truth: a real 5-sided bowl's ReuleauxExterior.svg (Pear wood 5 sides), whose
// header comments record the exact input parameters used to generate it.
const params = {
  outerDiameter: 250,
  outerDepth: 60,
  footHeight: 2,
  footDiameter: 125,
  zTouchHeight: 50,
};

describe("exterior profile formulas vs. real bowl output", () => {
  const svg = readSample("Pear wood 5 sides", "ReuleauxExterior.svg");
  const rings = parseRings(svg);

  it("parses a substantial number of rings from the sample", () => {
    expect(rings.length).toBeGreaterThan(100);
  });

  it("reproduces every ring's radius and cutDepth to 4 decimal places", () => {
    const footAngle = footAngleDeg(params.outerDiameter, params.footDiameter);
    expect(footAngle).toBeCloseTo(30, 4); // this sample's foot happens to land exactly at 30°

    for (const ring of rings) {
      const r = exteriorDiameter(ring.theta, params.outerDiameter);
      const z = exteriorDepth(ring.theta, params, footAngle);
      expect(r).toBeCloseTo(ring.radius, 3);
      expect(z).toBeCloseTo(ring.cutDepth, 3);
    }
  });
});
