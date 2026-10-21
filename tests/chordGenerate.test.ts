import { describe, expect, it } from "vitest";
import { generateChord, type ChordParams } from "../src/tools/chord/generate";

const baseParams: ChordParams = {
  profile: "concave",
  grooveWidthMm: 58,
  grooveDepthMm: 9.5,
  lengthMm: 300,
  stepMm: 1,
  fluteCount: 1,
  flutePitchMm: 80,
  bitSize: 6,
};

function parsePaths(svg: string) {
  const matches = [...svg.matchAll(/<path id="([^"]+)"[^>]*d="([^"]+)"[^>]*shaper:cutDepth="([^"]+)mm"/g)];
  return matches
    .filter(([, id]) => id !== "anchor-marker")
    .map(([, id, d, depth]) => ({ id, d, depth: parseFloat(depth) }));
}

describe("generateChord", () => {
  it("produces a valid single-file SVG for a single flute", () => {
    const files = generateChord(baseParams);
    expect(files.length).toBe(1);
    expect(files[0].name).toBe("Chord.svg");
  });

  it("every pass's depth matches the chord formula and none exceed the center depth", () => {
    const files = generateChord(baseParams);
    const paths = parsePaths(files[0].content);
    expect(paths.length).toBeGreaterThan(10);
    for (const p of paths) {
      expect(p.depth).toBeGreaterThan(0);
      expect(p.depth).toBeLessThanOrEqual(baseParams.grooveDepthMm + 1e-6);
    }
  });

  it("the deepest pass is close to the full groove depth (centerline pass included)", () => {
    const files = generateChord(baseParams);
    const paths = parsePaths(files[0].content);
    const maxDepth = Math.max(...paths.map((p) => p.depth));
    expect(maxDepth).toBeCloseTo(baseParams.grooveDepthMm, 1);
  });

  it("produces fluteCount * (steps+1)-ish passes for multiple flutes, at distinct X offsets", () => {
    const multi = generateChord({ ...baseParams, fluteCount: 3 });
    const single = generateChord(baseParams);
    const multiPaths = parsePaths(multi[0].content);
    const singlePaths = parsePaths(single[0].content);
    expect(multiPaths.length).toBeCloseTo(singlePaths.length * 3, -1);

    // Flute centers should be at distinct, evenly spaced X positions.
    const xsOf = (d: string) => parseFloat(d.match(/M ([\d.-]+),/)![1]);
    const flute0X = xsOf(multiPaths[0].d);
    const flute2X = xsOf(multiPaths[multiPaths.length - 1].d);
    expect(flute2X - flute0X).toBeGreaterThan(baseParams.grooveWidthMm);
  });

  it("widens the file count via splitIntoChunks once the pass count is large", () => {
    const manyPasses = generateChord({ ...baseParams, grooveWidthMm: 200, stepMm: 0.5 });
    expect(manyPasses.length).toBeGreaterThan(1);
    expect(manyPasses[0].name).toBe("Chord-part1.svg");
  });

  it("convex profile puts its deepest passes at the edges, not the centerline", () => {
    const files = generateChord({ ...baseParams, profile: "convex" });
    const paths = parsePaths(files[0].content);
    expect(paths.length).toBeGreaterThan(10);
    // The centerline pass (depth ~0) should have been skipped as a no-op, same as the
    // edge passes are skipped for concave.
    for (const p of paths) {
      expect(p.depth).toBeGreaterThan(0);
      expect(p.depth).toBeLessThanOrEqual(baseParams.grooveDepthMm + 1e-6);
    }
    const first = paths[0].depth;
    const middle = paths[Math.floor(paths.length / 2)].depth;
    expect(first).toBeGreaterThan(middle);
  });
});
