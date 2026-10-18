import { describe, expect, it } from "vitest";
import { rectangleOutline } from "../src/geometry/rectangle";
import { reuleauxPolygonOutline } from "../src/geometry/reuleauxPolygon";

// No sample exists for the rectangle special case (readme describes it qualitatively
// but we have no real output to check against) — these are self-consistency checks,
// not ground-truth validation. See the derivation note in rectangle.ts.

describe("rectangle construction (derived, no sample available)", () => {
  it("collapses to the sample-verified square construction as Dx -> Dy", () => {
    const D = 200;
    const square = reuleauxPolygonOutline(4, D, 0, 0, 0);
    const rect = rectangleOutline(D, D, 0, 0, 0);

    const squareCornerRadius = square.arcs[1].radius!;
    const rectLongRadius = Math.max(...rect.arcs.map((a) => a.radius!));
    expect(rectLongRadius).toBeCloseTo(squareCornerRadius, 6);

    const squareCorner = square.arcs[0].to; // arcs[0].to is a corner; arcs[1].to is a midpoint
    const squareCornerDist = Math.hypot(squareCorner.x, squareCorner.y);
    const rectCorner = rect.arcs[0].to; // corner_TL relative to centre (0,0)
    const rectCornerDist = Math.hypot(rectCorner.x, rectCorner.y);
    expect(rectCornerDist).toBeCloseTo(squareCornerDist, 6);
  });

  it("keeps every point within the notional bounding box for a range of aspect ratios", () => {
    for (const [Dx, Dy] of [
      [300, 180],
      [180, 300],
      [400, 150],
      [220, 200],
      [1000, 100],
    ]) {
      const outline = rectangleOutline(Dx, Dy, 0, 0, 0);
      const points = [outline.start, ...outline.arcs.map((a) => a.to)];
      for (const p of points) {
        expect(Math.abs(p.x)).toBeLessThanOrEqual(Dx / 2 + 1e-6);
        expect(Math.abs(p.y)).toBeLessThanOrEqual(Dy / 2 + 1e-6);
      }
    }
  });

  it("uses the short dimension directly as the short-side radius", () => {
    const Dx = 300;
    const Dy = 180;
    const outline = rectangleOutline(Dx, Dy, 0, 0, 0);
    const radii = outline.arcs.map((a) => a.radius!);
    expect(Math.min(...radii)).toBeCloseTo(Dy, 6);
  });

  it("produces all positive, finite radii across aspect ratios", () => {
    for (const [Dx, Dy] of [
      [300, 180],
      [180, 300],
      [400, 150],
      [1000, 50],
      [250, 249],
    ]) {
      const outline = rectangleOutline(Dx, Dy, 0, 0, 0);
      for (const a of outline.arcs) {
        expect(a.radius!).toBeGreaterThan(0);
        expect(Number.isFinite(a.radius)).toBe(true);
      }
    }
  });
});
