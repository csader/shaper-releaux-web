import { describe, expect, it } from "vitest";
import { parseSubpaths } from "./fixtures";
import { generateBowl } from "../src/tools/bowl/generate";

// Regression test for the "concave star" bug: radius+endpoints alone don't reliably
// pick the circle centered on the intended point (see reuleauxPolygon.ts notes) — an
// earlier implementation assumed sweep=0 always worked, which happened to look
// plausible for pentagon/heptagon but produced a visibly self-intersecting/concave
// shape for the triangle. Rather than assert a specific sweep-bit value (which isn't
// actually a meaningful invariant — see below), this checks the resulting shape is
// actually convex: every arc's midpoint must be farther from the shape's centroid
// than the chord connecting its endpoints is, i.e. it bulges outward, not inward.
describe("generated ring outlines are convex (no inverted/star arcs)", () => {
  const baseParams = {
    outerDiameter: 250,
    innerDiameter: 234,
    outerDepth: 60,
    innerDepth: 50,
    footHeight: 2,
    footDiameter: 125,
    zTouchHeight: 50,
    bitSize: 8,
    mmCut: 0.5,
    interiorModel: "circumferential" as const,
    exteriorModel: "circumferential" as const,
  };

  function assertConvex(d: string, label: string) {
    const [subpath] = parseSubpaths(d);
    const points = [subpath.start, ...subpath.arcs.map((a) => ({ x: a.x, y: a.y }))];
    const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
    const cy = points.reduce((s, p) => s + p.y, 0) / points.length;

    let prev = subpath.start;
    for (const arc of subpath.arcs) {
      const chordMid = { x: (prev.x + arc.x) / 2, y: (prev.y + arc.y) / 2 };
      const chordDist = Math.hypot(chordMid.x - cx, chordMid.y - cy);
      // Sample the arc's own midpoint via the sagitta direction (perpendicular to the
      // chord, offset by the known circle's geometry) — simpler: just check the arc's
      // radius/sweep imply a bulge away from centroid by comparing against the
      // farther candidate centre, reusing the same calibrated formula as production.
      const dx = arc.x - prev.x;
      const dy = arc.y - prev.y;
      const d2 = Math.hypot(dx, dy);
      const h = Math.sqrt(Math.max(arc.rx * arc.rx - (d2 / 2) ** 2, 0));
      const ux = -dy / d2;
      const uy = dx / d2;
      const candidate = arc.sweep === 1 ? { x: chordMid.x + ux * h, y: chordMid.y + uy * h } : { x: chordMid.x - ux * h, y: chordMid.y - uy * h };
      // Arc midpoint sits on the far side of the chord from its centre, at distance
      // (radius - distance(centre, chordMid)) beyond the chord, in the direction away
      // from the centre.
      const centerToChord = Math.hypot(chordMid.x - candidate.x, chordMid.y - candidate.y);
      const sagittaDir = { x: (chordMid.x - candidate.x) / (centerToChord || 1), y: (chordMid.y - candidate.y) / (centerToChord || 1) };
      const arcMid = { x: chordMid.x + sagittaDir.x * (arc.rx - centerToChord), y: chordMid.y + sagittaDir.y * (arc.rx - centerToChord) };
      const arcMidDist = Math.hypot(arcMid.x - cx, arcMid.y - cy);

      expect(arcMidDist, `${label}: arc from (${prev.x},${prev.y}) to (${arc.x},${arc.y}) bulges inward`).toBeGreaterThanOrEqual(
        chordDist - 1e-6,
      );
      prev = { x: arc.x, y: arc.y };
    }
  }

  it("produces convex exterior and interior finishing rings for every shape", () => {
    for (const sides of [1, 2, 3, 4, 5, 6, 7] as const) {
      const files = generateBowl({ ...baseParams, sides });
      for (const kind of ["ReuleauxExterior", "ReuleauxInterior"]) {
        const file = files.find((f) => f.name.startsWith(kind) && !f.name.includes("Roughing"))!;
        const d = file.content.match(/<path[\s\S]*?\sd="([^"]+)"/)![1];
        assertConvex(d, `sides=${sides} ${kind}`);
      }
    }
  });
});
