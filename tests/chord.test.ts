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

describe("chordDepthAt (convex profile — reeding, the complement of concave fluting)", () => {
  it("is zero at the centerline (the bead's uncut peak)", () => {
    expect(chordDepthAt(0, 29, 9.5, "convex")).toBeCloseTo(0, 6);
  });

  it("equals the full depth at both surface edges", () => {
    expect(chordDepthAt(29, 29, 9.5, "convex")).toBeCloseTo(9.5, 6);
    expect(chordDepthAt(-29, 29, 9.5, "convex")).toBeCloseTo(9.5, 6);
  });

  it("is symmetric about the centerline", () => {
    expect(chordDepthAt(10, 29, 9.5, "convex")).toBeCloseTo(chordDepthAt(-10, 29, 9.5, "convex"), 10);
  });

  it("increases monotonically from center to edge (opposite of concave)", () => {
    const samples = [0, 5, 10, 15, 20, 25, 29].map((x) => chordDepthAt(x, 29, 9.5, "convex"));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it("is the exact complement of concave at every offset (concave + convex = full depth)", () => {
    for (const x of [0, 5, 12, 20, 29]) {
      const concave = chordDepthAt(x, 29, 9.5, "concave");
      const convex = chordDepthAt(x, 29, 9.5, "convex");
      expect(concave + convex).toBeCloseTo(9.5, 6);
    }
  });
});

describe("chordDepthAt (ogee profile — a cyma S-curve, not a circular arc)", () => {
  it("is zero at the low edge (X = -halfWidth)", () => {
    expect(chordDepthAt(-29, 29, 9.5, "ogee")).toBeCloseTo(0, 6);
  });

  it("equals the full depth at the high edge (X = +halfWidth)", () => {
    expect(chordDepthAt(29, 29, 9.5, "ogee")).toBeCloseTo(9.5, 6);
  });

  it("is exactly half depth at the centerline (the inflection point)", () => {
    expect(chordDepthAt(0, 29, 9.5, "ogee")).toBeCloseTo(4.75, 6);
  });

  it("is strictly increasing from low edge to high edge (monotonic ramp, unlike concave/convex)", () => {
    const samples = [-29, -20, -10, 0, 10, 20, 29].map((x) => chordDepthAt(x, 29, 9.5, "ogee"));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it("clamps to 0/full depth rather than extrapolating past either edge", () => {
    expect(chordDepthAt(-40, 29, 9.5, "ogee")).toBe(0);
    expect(chordDepthAt(40, 29, 9.5, "ogee")).toBeCloseTo(9.5, 6);
  });
});
