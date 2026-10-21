import { describe, expect, it } from "vitest";
import {
  dedupeConsecutive,
  minRadiusOfCurvature,
  normalAt,
  offsetPoint,
  offsetPolyline,
  radiusOfCurvatureAt,
  tangentAt,
} from "../src/geometry/offsetPath";
import type { Point } from "../src/geometry/customShape";

function straightLine(n: number): Point[] {
  return Array.from({ length: n }, (_, i) => ({ x: 0, y: i * 10 }));
}

function quarterCircle(radius: number, n: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const theta = (Math.PI / 2) * (i / (n - 1));
    return { x: radius * Math.sin(theta), y: radius * (1 - Math.cos(theta)) };
  });
}

describe("tangentAt / normalAt", () => {
  it("tangent along a straight vertical line points straight up (constant for every index)", () => {
    const line = straightLine(10);
    for (let i = 0; i < line.length; i++) {
      const t = tangentAt(line, i);
      expect(t.x).toBeCloseTo(0, 6);
      expect(t.y).toBeCloseTo(1, 6);
    }
  });

  it("normal on a straight vertical line is a constant horizontal unit vector", () => {
    const line = straightLine(10);
    const n0 = normalAt(line, 0);
    for (let i = 1; i < line.length; i++) {
      const n = normalAt(line, i);
      expect(n.x).toBeCloseTo(n0.x, 6);
      expect(n.y).toBeCloseTo(n0.y, 6);
    }
    expect(Math.hypot(n0.x, n0.y)).toBeCloseTo(1, 6);
  });

  it("offsetting a straight line moves every point by exactly the offset distance, perpendicular to travel", () => {
    const line = straightLine(10);
    const offset = offsetPolyline(line, 5);
    for (let i = 0; i < line.length; i++) {
      expect(Math.hypot(offset[i].x - line[i].x, offset[i].y - line[i].y)).toBeCloseTo(5, 6);
      // Y (the direction of travel) is unchanged; only X shifts.
      expect(offset[i].y).toBeCloseTo(line[i].y, 6);
    }
  });

  it("normal direction sanity on a quarter circle: offsetting outward moves interior points farther from the center", () => {
    const radius = 50;
    const circle = quarterCircle(radius, 20);
    const center = { x: 0, y: radius };
    const i = 10;
    const distToCenter = (p: Point) => Math.hypot(p.x - center.x, p.y - center.y);
    const outward = offsetPoint(circle, i, 5);
    const inward = offsetPoint(circle, i, -5);
    // One direction must move farther from the center and the other closer — confirms
    // the normal's sign is meaningful (not just magnitude), without pinning down which
    // literal sign that is (that's exactly what the flipSide UI toggle is for).
    const base = distToCenter(circle[i]);
    const outDist = Math.abs(distToCenter(outward) - base);
    const inDist = Math.abs(distToCenter(inward) - base);
    expect(outDist).toBeGreaterThan(4);
    expect(inDist).toBeGreaterThan(4);
    expect(Math.sign(distToCenter(outward) - base)).not.toBe(Math.sign(distToCenter(inward) - base));
  });
});

describe("radiusOfCurvatureAt / minRadiusOfCurvature", () => {
  it("is Infinity everywhere on a straight line (zero curvature)", () => {
    const line = straightLine(10);
    expect(minRadiusOfCurvature(line)).toBe(Infinity);
    for (let i = 1; i < line.length - 1; i++) {
      expect(radiusOfCurvatureAt(line, i)).toBe(Infinity);
    }
  });

  it("is close to the true radius at interior points of a sampled circle", () => {
    const radius = 50;
    const circle = quarterCircle(radius, 30);
    for (let i = 5; i < circle.length - 5; i++) {
      expect(radiusOfCurvatureAt(circle, i)).toBeCloseTo(radius, 0);
    }
  });

  it("is small for a tightly curved bend (a small-radius arc), confirming cusp-style detection", () => {
    const tightBend = quarterCircle(2, 10);
    expect(radiusOfCurvatureAt(tightBend, 5)).toBeLessThan(5);
  });

  it("returns Infinity for fewer than 3 points", () => {
    expect(minRadiusOfCurvature([{ x: 0, y: 0 }])).toBe(Infinity);
    expect(
      minRadiusOfCurvature([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]),
    ).toBe(Infinity);
  });
});

describe("dedupeConsecutive", () => {
  it("collapses near-duplicate adjacent points", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0.0001 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ];
    const deduped = dedupeConsecutive(points);
    expect(deduped.length).toBe(3);
    expect(deduped[0]).toEqual({ x: 0, y: 0 });
  });

  it("leaves distinct points untouched", () => {
    const points = straightLine(5);
    expect(dedupeConsecutive(points)).toEqual(points);
  });
});
