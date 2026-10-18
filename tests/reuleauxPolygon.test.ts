import { describe, expect, it } from "vitest";
import { reuleauxPolygonOutline } from "../src/geometry/reuleauxPolygon";
import { bestCyclicAlignment, circumcenter, parseSubpaths, readSample } from "./fixtures";

function expectPointsClose(
  actual: { x: number; y: number }[],
  expected: { x: number; y: number }[],
  precision = 1,
) {
  expect(actual.length).toBe(expected.length);
  for (let i = 0; i < actual.length; i++) {
    expect(actual[i].x).toBeCloseTo(expected[i].x, precision);
    expect(actual[i].y).toBeCloseTo(expected[i].y, precision);
  }
}

describe("odd-n true Reuleaux construction vs. real 5-sided bowl", () => {
  it("reproduces the pentagon's vertex positions exactly", () => {
    const svg = readSample("Pear wood 5 sides", "ReuleauxExteriorRoughing.svg");
    const d = svg.match(/<path[^>]*\n\s*d="([^"]+)"/)![1];
    const subpaths = parseSubpaths(d);
    // Subpath 0 is the static stock-boundary circle; subpath 1 is the pentagon ring.
    const shape = subpaths[1];
    const D = shape.arcs[0].rx;
    const samplePoints = [shape.start, ...shape.arcs.map((a) => ({ x: a.x, y: a.y }))];

    const center = circumcenter(samplePoints[0], samplePoints[1], samplePoints[2]);
    const outline = reuleauxPolygonOutline(5, D, center.x, center.y, shape.arcs[0].sweep);
    const generatedPoints = [outline.start, ...outline.arcs.map((a) => a.to)];
    const aligned = bestCyclicAlignment(generatedPoints, samplePoints);

    expectPointsClose(aligned, samplePoints);
  });
});

describe("even-n radiused construction vs. real square bowl", () => {
  it("reproduces the square's 8-point outline exactly", () => {
    const svg = readSample("3 more Shapermade bowls", "square bowl outside.svg");
    const d = svg.match(/<path[^>]*\n\s*d="([^"]+)"/)![1];
    const [shape] = parseSubpaths(d);
    const D = shape.arcs[0].rx;
    const samplePoints = [shape.start, ...shape.arcs.map((a) => ({ x: a.x, y: a.y }))];

    // Shape centre = midpoint of two opposite midpoint-points (sample indices 0 and 4:
    // top-mid and bottom-mid in the 8-point alternating sequence).
    const cx = (samplePoints[0].x + samplePoints[4].x) / 2;
    const cy = (samplePoints[0].y + samplePoints[4].y) / 2;

    const outline = reuleauxPolygonOutline(4, D, cx, cy, shape.arcs[0].sweep);
    const generatedPoints = [outline.start, ...outline.arcs.map((a) => a.to)];
    const aligned = bestCyclicAlignment(generatedPoints, samplePoints);

    expectPointsClose(aligned, samplePoints);
  });
});
