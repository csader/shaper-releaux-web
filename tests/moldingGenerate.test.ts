import { describe, expect, it } from "vitest";
import { generateMolding, type MoldingParams } from "../src/tools/molding/generate";
import { generateChord, type ChordParams } from "../src/tools/chord/generate";
import type { Point } from "../src/geometry/customShape";

function straightGuide(lengthMm: number, n = 50): Point[] {
  return Array.from({ length: n }, (_, i) => ({ x: 0, y: (lengthMm * i) / (n - 1) }));
}

function quarterCircleGuide(radius: number, n = 40): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const theta = (Math.PI / 2) * (i / (n - 1));
    return { x: radius * Math.sin(theta), y: radius * (1 - Math.cos(theta)) };
  });
}

function parsePaths(svg: string) {
  const matches = [...svg.matchAll(/<path id="([^"]+)"[^>]*d="([^"]+)"[^>]*shaper:cutDepth="([^"]+)mm"/g)];
  return matches
    .filter(([, id]) => id !== "anchor-marker")
    .map(([, id, d, depth]) => ({ id, d, depth: parseFloat(depth) }));
}

const baseParams: MoldingParams = {
  profile: "concave",
  widthMm: 58,
  depthMm: 9.5,
  stepMm: 1,
  bitSize: 6,
  flipSide: false,
  guidePoints: straightGuide(300),
};

describe("generateMolding", () => {
  it("produces a valid single-file SVG", () => {
    const files = generateMolding(baseParams);
    expect(files.length).toBe(1);
    expect(files[0].name).toBe("Molding.svg");
  });

  it("every pass's depth matches the chord formula and none exceed the max depth", () => {
    const files = generateMolding(baseParams);
    const paths = parsePaths(files[0].content);
    expect(paths.length).toBeGreaterThan(10);
    for (const p of paths) {
      expect(p.depth).toBeGreaterThan(0);
      expect(p.depth).toBeLessThanOrEqual(baseParams.depthMm + 1e-6);
    }
  });

  it("every pass's polyline has the same number of points as the guide curve", () => {
    const files = generateMolding(baseParams);
    const paths = parsePaths(files[0].content);
    const pointCountOf = (d: string) => d.split(" L ").length; // "M x,y L x,y L x,y..."
    for (const p of paths) {
      expect(pointCountOf(p.d)).toBe(baseParams.guidePoints.length);
    }
  });

  it("straight-line guide degenerates to the same depths/pass-count as the Chord tool", () => {
    const lengthMm = 300;
    const moldingParams: MoldingParams = { ...baseParams, guidePoints: straightGuide(lengthMm) };
    const chordParams: ChordParams = {
      profile: "concave",
      grooveWidthMm: baseParams.widthMm,
      grooveDepthMm: baseParams.depthMm,
      lengthMm,
      stepMm: baseParams.stepMm,
      fluteCount: 1,
      flutePitchMm: 80,
      bitSize: baseParams.bitSize,
    };
    const moldingPaths = parsePaths(generateMolding(moldingParams)[0].content);
    const chordPaths = parsePaths(generateChord(chordParams)[0].content);
    expect(moldingPaths.length).toBe(chordPaths.length);
    const moldingDepths = moldingPaths.map((p) => p.depth).sort((a, b) => a - b);
    const chordDepths = chordPaths.map((p) => p.depth).sort((a, b) => a - b);
    for (let i = 0; i < moldingDepths.length; i++) {
      expect(moldingDepths[i]).toBeCloseTo(chordDepths[i], 3);
    }
  });

  it("on a curved guide, every pass still carries exactly one constant depth value", () => {
    const curvedParams: MoldingParams = { ...baseParams, guidePoints: quarterCircleGuide(100) };
    const files = generateMolding(curvedParams);
    const paths = parsePaths(files[0].content);
    expect(paths.length).toBeGreaterThan(5);
    const ids = new Set(paths.map((p) => p.id));
    expect(ids.size).toBe(paths.length);
  });

  it("convex and ogee profiles stay within bounds on a curved guide", () => {
    for (const profile of ["convex", "ogee"] as const) {
      const files = generateMolding({ ...baseParams, guidePoints: quarterCircleGuide(100), profile });
      const paths = parsePaths(files[0].content);
      expect(paths.length).toBeGreaterThan(5);
      for (const p of paths) {
        expect(p.depth).toBeGreaterThan(0);
        expect(p.depth).toBeLessThanOrEqual(baseParams.depthMm + 1e-6);
      }
    }
  });

  it("flipSide negates the offset direction (mirrors which side the molding falls on)", () => {
    const curvedParams: MoldingParams = { ...baseParams, guidePoints: quarterCircleGuide(100), profile: "ogee" };
    const normalPaths = parsePaths(generateMolding(curvedParams)[0].content);
    const flippedPaths = parsePaths(generateMolding({ ...curvedParams, flipSide: true })[0].content);
    expect(normalPaths.length).toBe(flippedPaths.length);
    // Same depths (chordDepthAt doesn't depend on offset sign), different actual
    // coordinates (sign of the offset flips which side of the guide gets cut).
    expect(normalPaths[0].depth).toBeCloseTo(flippedPaths[0].depth, 6);
    expect(normalPaths[0].d).not.toBe(flippedPaths[0].d);
  });

  it("widens the file count via splitIntoChunks once the pass count is large", () => {
    const manyPasses = generateMolding({ ...baseParams, widthMm: 200, stepMm: 0.5 });
    expect(manyPasses.length).toBeGreaterThan(1);
    expect(manyPasses[0].name).toBe("Molding-part1.svg");
  });

  it("bounding box in the generated SVG contains every emitted coordinate", () => {
    const curvedParams: MoldingParams = { ...baseParams, guidePoints: quarterCircleGuide(100) };
    const files = generateMolding(curvedParams);
    const svg = files[0].content;
    const viewBoxMatch = svg.match(/viewBox="([^"]+)"/);
    expect(viewBoxMatch).toBeTruthy();
    const [originX, originY, w, h] = viewBoxMatch![1].split(/\s+/).map(Number);
    const paths = parsePaths(svg);
    for (const p of paths) {
      const coords = [...p.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
        x: parseFloat(m[1]),
        y: parseFloat(m[2]),
      }));
      for (const c of coords) {
        expect(c.x).toBeGreaterThanOrEqual(originX - 1e-3);
        expect(c.x).toBeLessThanOrEqual(originX + w + 1e-3);
        expect(c.y).toBeGreaterThanOrEqual(originY - 1e-3);
        expect(c.y).toBeLessThanOrEqual(originY + h + 1e-3);
      }
    }
  });
});
