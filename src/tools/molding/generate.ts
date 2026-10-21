// Molding profile generator: a cross-section (concave groove, convex bead, or ogee
// S-curve — see geometry/chord.ts) applied along an arbitrary curved guide path,
// rather than the straight line the Chord tool is limited to. Each pass is the
// guide curve's own point sequence, displaced along its local normal by a constant
// offset (see geometry/offsetPath.ts), cut at the depth the cross-section calls for
// at that offset — same depth-lookup-per-offset model as Chord's flutePasses, just
// emitting a full polyline per pass instead of a single 2-point line.
//
// A straight-line guide curve is a degenerate case of this: every point's normal is
// the same constant perpendicular vector, so the output reduces exactly to what
// generateChord would produce for equivalent params (see tests/moldingGenerate.test.ts).

import { buildShaperSvg, type CutPath } from "../../svg/shaperSvg";
import { splitIntoChunks } from "../../svg/fileSplit";
import type { GeneratedFile } from "../../types";
import { chordDepthAt, type ChordProfile } from "../../geometry/chord";
import { minRadiusOfCurvature, offsetPoint } from "../../geometry/offsetPath";
import { boundingBox, type Point } from "../../geometry/customShape";

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export interface MoldingParams {
  profile: ChordProfile;
  /** Cross-section width (2 * halfWidth). */
  widthMm: number;
  depthMm: number;
  /** Spacing between adjacent offset passes across widthMm. */
  stepMm: number;
  bitSize: number;
  /** Negates the offset direction — covers guide curves drawn with either winding,
   * without requiring the user to re-draw/reverse their SVG. */
  flipSide: boolean;
  /** Already real-world-mm, already deduped guide curve points. */
  guidePoints: Point[];
}

function polylinePathData(points: Point[]): string {
  const [first, ...rest] = points;
  return `M ${round(first.x)},${round(first.y)} L ${rest.map((p) => `${round(p.x)},${round(p.y)}`).join(" L ")}`;
}

function offsetPass(guide: Point[], offsetMm: number): Point[] {
  return guide.map((_, i) => offsetPoint(guide, i, offsetMm));
}

function moldingPasses(p: MoldingParams): CutPath[] {
  const halfWidth = p.widthMm / 2;
  const steps = Math.max(1, Math.round(p.widthMm / p.stepMm));
  const sign = p.flipSide ? -1 : 1;
  const paths: CutPath[] = [];
  for (let i = 0; i <= steps; i++) {
    const offset = -halfWidth + (p.widthMm * i) / steps;
    const depth = chordDepthAt(offset, halfWidth, p.depthMm, p.profile);
    // Same no-op guard as chord's flutePasses: concave skips the edges, convex skips
    // the center, ogee skips its single zero-depth edge.
    if (depth <= 0) continue;
    paths.push({
      id: `m${i}`,
      d: polylinePathData(offsetPass(p.guidePoints, sign * offset)),
      cutType: "online",
      cutDepthMm: round(depth),
      toolDiaMm: p.bitSize,
    });
  }
  return paths;
}

export function generateMolding(params: MoldingParams): GeneratedFile[] {
  const halfWidth = params.widthMm / 2;
  const paths = moldingPasses(params);

  // Conservative bbox: the guide curve's own bbox expanded by halfWidth in every
  // direction (every offset point is within halfWidth of its guide point, by
  // construction) plus bit clearance.
  const bbox = boundingBox(params.guidePoints);
  const pad = halfWidth + params.bitSize;

  const comments: Record<string, string | number> = {
    Profile: params.profile,
    Width: params.widthMm,
    Depth: params.depthMm,
    Step: params.stepMm,
    "Bit Size": params.bitSize,
    "Min Radius Of Curvature": round(minRadiusOfCurvature(params.guidePoints)),
  };

  const chunks = splitIntoChunks(paths);
  return chunks.map((chunk, i) => {
    const name = `Molding${chunks.length > 1 ? `-part${i + 1}` : ""}.svg`;
    return {
      name,
      content: buildShaperSvg({
        boundingWidthMm: bbox.maxX - bbox.minX + 2 * pad,
        boundingHeightMm: bbox.maxY - bbox.minY + 2 * pad,
        originX: bbox.minX - pad,
        originY: bbox.minY - pad,
        paths: chunk,
        comments,
        docName: name,
      }),
    };
  });
}
