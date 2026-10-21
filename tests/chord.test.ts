import { describe, expect, it } from "vitest";
import { chordDepthAt, chordRadius } from "../src/geometry/chord";

describe("chordRadius", () => {
  it("matches the reference example (58mm chord, 9.5mm depth -> ~49mm radius)", () => {
    expect(chordRadius(29, 9.5)).toBeCloseTo(49.013, 2);
  });
});

describe("chordDepthAt", () => {
  it("equals the full groove depth at the centerline", () => {
    expect(chordDepthAt(0, 29, 9.5)).toBeCloseTo(9.5, 6);
  });

  it("is zero at both surface edges (X = +-halfWidth)", () => {
    expect(chordDepthAt(29, 29, 9.5)).toBeCloseTo(0, 6);
    expect(chordDepthAt(-29, 29, 9.5)).toBeCloseTo(0, 6);
  });

  it("is symmetric about the centerline", () => {
    expect(chordDepthAt(10, 29, 9.5)).toBeCloseTo(chordDepthAt(-10, 29, 9.5), 10);
  });

  it("decreases monotonically from center to edge", () => {
    const samples = [0, 5, 10, 15, 20, 25, 29].map((x) => chordDepthAt(x, 29, 9.5));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThan(samples[i - 1]);
    }
  });

  it("clamps to zero rather than going negative just past the edge", () => {
    expect(chordDepthAt(30, 29, 9.5)).toBe(0);
  });
});
