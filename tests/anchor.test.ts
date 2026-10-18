import { describe, expect, it } from "vitest";
import { anchorTrianglePathData, resolveAnchorPoint, type AnchorConfig, type BoundingBox } from "../src/svg/anchor";

const box: BoundingBox = { originX: -10, originY: -10, width: 100, height: 60 };

describe("resolveAnchorPoint", () => {
  it("returns null when disabled, regardless of position", () => {
    const anchor: AnchorConfig = { enabled: false, position: "center" };
    expect(resolveAnchorPoint(anchor, box)).toBeNull();
  });

  it("resolves all nine grid positions against the box's edges/midlines", () => {
    const cases: [AnchorConfig["position"], { x: number; y: number }][] = [
      ["top-left", { x: -10, y: -10 }],
      ["top-center", { x: 40, y: -10 }],
      ["top-right", { x: 90, y: -10 }],
      ["middle-left", { x: -10, y: 20 }],
      ["center", { x: 40, y: 20 }],
      ["middle-right", { x: 90, y: 20 }],
      ["bottom-left", { x: -10, y: 50 }],
      ["bottom-center", { x: 40, y: 50 }],
      ["bottom-right", { x: 90, y: 50 }],
    ];
    for (const [position, expected] of cases) {
      const result = resolveAnchorPoint({ enabled: true, position }, box);
      expect(result).toEqual(expected);
    }
  });

  it("uses customX/customY for position=custom", () => {
    const anchor: AnchorConfig = { enabled: true, position: "custom", customX: 12, customY: 34 };
    expect(resolveAnchorPoint(anchor, box)).toEqual({ x: 12, y: 34 });
  });

  it("falls back to box center for position=custom with no coordinates given", () => {
    const anchor: AnchorConfig = { enabled: true, position: "custom" };
    expect(resolveAnchorPoint(anchor, box)).toEqual({ x: 40, y: 20 });
  });

  it("uses trueCenter (not the box midpoint) for every position that references the midline", () => {
    // Odd-n Reuleaux shapes aren't centered in their own declared bounding box — this
    // is what makes "center" (and the other midline positions) land on the shape
    // instead of an arbitrary offset point. See shapeCenterFor in tools/bowl/generate.ts.
    const trueCenter = { x: 37, y: 15 };
    expect(resolveAnchorPoint({ enabled: true, position: "center" }, box, trueCenter)).toEqual(trueCenter);
    expect(resolveAnchorPoint({ enabled: true, position: "top-center" }, box, trueCenter)).toEqual({ x: 37, y: -10 });
    expect(resolveAnchorPoint({ enabled: true, position: "middle-left" }, box, trueCenter)).toEqual({ x: -10, y: 15 });
    // Corners are untouched by trueCenter — they're defined by the box edges, not the midline.
    expect(resolveAnchorPoint({ enabled: true, position: "top-left" }, box, trueCenter)).toEqual({ x: -10, y: -10 });
  });
});

describe("anchorTrianglePathData", () => {
  it("places the right angle at the given point, with a shorter X leg and longer Y leg", () => {
    const d = anchorTrianglePathData(5, 5, "top-left");
    // top-left direction is (+1, +1): legs extend toward +x and +y.
    expect(d).toBe("M 5 5 L 10 5 L 5 15 Z");
  });

  it("flips leg direction per position so the marker points into the bounding box", () => {
    expect(anchorTrianglePathData(0, 0, "bottom-right")).toBe("M 0 0 L -5 0 L 0 -10 Z");
    expect(anchorTrianglePathData(0, 0, "top-right")).toBe("M 0 0 L -5 0 L 0 10 Z");
  });
});
