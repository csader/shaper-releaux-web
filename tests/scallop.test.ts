import { describe, expect, it } from "vitest";
import { scallopHeight } from "../src/geometry/scallop";

describe("scallopHeight", () => {
  it("matches the exact geometric formula for a known case", () => {
    // bit diameter 8mm (radius 4), mmCut 1mm -> half=0.5
    // h = 4 - sqrt(16 - 0.25) = 4 - sqrt(15.75)
    const expected = 4 - Math.sqrt(15.75);
    expect(scallopHeight(8, 1)).toBeCloseTo(expected, 10);
  });

  it("is larger for a smaller bit diameter at the same mmCut", () => {
    const small = scallopHeight(6, 1)!;
    const large = scallopHeight(12, 1)!;
    expect(small).toBeGreaterThan(large);
  });

  it("is larger for a bigger mmCut at the same bit diameter", () => {
    const fine = scallopHeight(8, 0.25)!;
    const coarse = scallopHeight(8, 1)!;
    expect(coarse).toBeGreaterThan(fine);
  });

  it("approaches zero as mmCut approaches zero", () => {
    expect(scallopHeight(8, 0.001)).toBeCloseTo(0, 4);
  });

  it("returns null when mmCut meets or exceeds the bit diameter (would leave gaps)", () => {
    expect(scallopHeight(8, 8)).toBeNull();
    expect(scallopHeight(8, 10)).toBeNull();
  });
});
