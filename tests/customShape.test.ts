import { describe, expect, it } from "vitest";
import {
  centroidWithHoles,
  compoundShapeToPathData,
  holeIsContained,
  isSimplePolygon,
  normalizeShape,
  scaleCompoundShape,
  signedArea,
  type Loop,
} from "../src/geometry/customShape";

const square = (x0: number, y0: number, x1: number, y1: number): Loop => [
  { x: x0, y: y0 },
  { x: x1, y: y0 },
  { x: x1, y: y1 },
  { x: x0, y: y1 },
];

describe("signedArea", () => {
  it("matches the known area of a simple square", () => {
    expect(Math.abs(signedArea(square(0, 0, 10, 10)))).toBeCloseTo(100, 6);
  });
});

describe("centroidWithHoles", () => {
  it("matches a hand-computed composite centroid for an off-center hole", () => {
    // outer: 10x10 square, area=100, centroid=(5,5)
    // hole: 2x2 square at [1,1]-[3,3], area=4, centroid=(2,2)
    // composite = (100*5 - 4*2) / (100-4) = 492/96 = 5.125 on both axes
    const outer = square(0, 0, 10, 10);
    const hole = square(1, 1, 3, 3);
    const c = centroidWithHoles(outer, [hole]);
    expect(c.fellBack).toBe(false);
    expect(c.x).toBeCloseTo(5.125, 6);
    expect(c.y).toBeCloseTo(5.125, 6);
  });

  it("falls back to bounding-box center for a degenerate hole-dominated shape", () => {
    // A hole nearly as large as the outer loop pushes the composite centroid
    // outside the remaining region for a sufficiently lopsided configuration.
    const outer = square(0, 0, 10, 10);
    const hole = square(0.1, 0.1, 9.9, 9.9); // area ~= outer area, denom near 0
    const c = centroidWithHoles(outer, [hole]);
    expect(c.fellBack).toBe(true);
  });
});

describe("isSimplePolygon", () => {
  it("accepts a simple square", () => {
    expect(isSimplePolygon(square(0, 0, 10, 10))).toBe(true);
  });

  it("rejects a self-intersecting bowtie quadrilateral", () => {
    const bowtie: Loop = [
      { x: 0, y: 0 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(isSimplePolygon(bowtie)).toBe(false);
  });
});

describe("holeIsContained", () => {
  const outer = square(0, 0, 10, 10);

  it("accepts a hole fully inside the outer loop", () => {
    expect(holeIsContained(square(2, 2, 4, 4), outer)).toBe(true);
  });

  it("rejects a hole that crosses the outer boundary", () => {
    expect(holeIsContained(square(8, 8, 12, 12), outer)).toBe(false);
  });

  it("rejects a hole entirely outside the outer loop", () => {
    expect(holeIsContained(square(20, 20, 24, 24), outer)).toBe(false);
  });
});

describe("normalizeShape + scaleCompoundShape", () => {
  it("round-trips a square to a known scaled size and position", () => {
    const normalized = normalizeShape(square(0, 0, 10, 10), []);
    // Outer bounding width should be exactly 1 after normalization.
    const xs = normalized.outer.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1, 6);

    const scaled = scaleCompoundShape(normalized, 50, 100, 200);
    const sxs = scaled.outer.map((p) => p.x);
    const sys = scaled.outer.map((p) => p.y);
    expect(Math.max(...sxs) - Math.min(...sxs)).toBeCloseTo(50, 6);
    // Centered at (100, 200): average of a symmetric square's points equals its centre.
    expect(sxs.reduce((a, b) => a + b, 0) / sxs.length).toBeCloseTo(100, 6);
    expect(sys.reduce((a, b) => a + b, 0) / sys.length).toBeCloseTo(200, 6);
  });
});

/** Minimal M/L/Z polyline path parser for testing compoundShapeToPathData's output
 * (the existing tests/fixtures.ts parser is arc-command-specific for the native
 * shape samples, so this is a small, separate, purpose-built parser). */
function parsePolylineSubpaths(d: string): { x: number; y: number }[][] {
  const subpaths: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  const tokens = d.match(/[MLZ]|-?[0-9.]+/g) ?? [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "M") {
      if (current.length) subpaths.push(current);
      current = [];
      i++;
      current.push({ x: parseFloat(tokens[i++]), y: parseFloat(tokens[i++]) });
    } else if (tok === "L") {
      i++;
      current.push({ x: parseFloat(tokens[i++]), y: parseFloat(tokens[i++]) });
    } else if (tok === "Z") {
      i++;
    } else {
      i++;
    }
  }
  if (current.length) subpaths.push(current);
  return subpaths;
}

describe("compoundShapeToPathData", () => {
  it("emits the outer loop and each hole as separate subpaths with opposite winding", () => {
    const outer = square(0, 0, 10, 10);
    const hole = square(2, 2, 4, 4);
    const shape = { outer, holes: [hole] };

    const d = compoundShapeToPathData(shape, false);
    const subpaths = parsePolylineSubpaths(d);
    expect(subpaths.length).toBe(2);

    const outerAreaSign = Math.sign(signedArea(subpaths[0]));
    const holeAreaSign = Math.sign(signedArea(subpaths[1]));
    expect(outerAreaSign).not.toBe(holeAreaSign);
  });

  it("flips which loop gets which winding when reversed=true", () => {
    const outer = square(0, 0, 10, 10);
    const hole = square(2, 2, 4, 4);
    const shape = { outer, holes: [hole] };

    const forward = parsePolylineSubpaths(compoundShapeToPathData(shape, false));
    const reversed = parsePolylineSubpaths(compoundShapeToPathData(shape, true));

    expect(Math.sign(signedArea(forward[0]))).not.toBe(Math.sign(signedArea(reversed[0])));
    expect(Math.sign(signedArea(forward[1]))).not.toBe(Math.sign(signedArea(reversed[1])));
  });
});
