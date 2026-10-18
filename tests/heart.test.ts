import { describe, expect, it } from "vitest";
import { heartOutline } from "../src/geometry/heart";
import { parseSubpaths, readSample } from "./fixtures";

describe("heart construction vs. real Valentine's bowl", () => {
  it("reproduces the heart's 6-point outline exactly", () => {
    const svg = readSample("Valentine's bowl", "Heart bowl topside.svg");
    const d = svg.match(/<path[^>]*\n\s*d="([^"]+)"/)![1];
    const [shape] = parseSubpaths(d);
    const D = shape.arcs[1].rx; // arcs[0] is a lobe circle; arcs[1] is the big lower arc
    const samplePoints = [shape.start, ...shape.arcs.map((a) => ({ x: a.x, y: a.y }))];
    // Sequence: leftTop, leftOuter, bottom, rightOuter, rightTop, notch, leftTop
    const [leftTop, , bottom, , rightTop] = samplePoints;

    const cx = (leftTop.x + rightTop.x) / 2;
    const cy = (leftTop.y + bottom.y) / 2;

    const outline = heartOutline(D, cx, cy, shape.arcs[0].sweep);
    const generatedPoints = [outline.start, ...outline.arcs.map((a) => a.to)];

    expect(generatedPoints.length).toBe(samplePoints.length);
    for (let i = 0; i < generatedPoints.length; i++) {
      expect(generatedPoints[i].x).toBeCloseTo(samplePoints[i].x, 0);
      expect(generatedPoints[i].y).toBeCloseTo(samplePoints[i].y, 0);
    }
  });
});
