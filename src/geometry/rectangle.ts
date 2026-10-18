// Rectangle special case for n=4 with unequal Dx/Dy. No sample exists for this (it's
// the one bowl-tool gap we couldn't source), so this is derived rather than reverse-
// engineered — but derived to satisfy the readme's stated rule, and checked for
// self-consistency: setting Dx=Dy collapses it to the *same* corner radius and corner
// position as the sample-verified square construction (reuleauxPolygon.ts), exactly.
// Treat as best-effort / unverified against the real app.
//
// Rule (from the readme): the short sides' arcs use the short dimension directly as
// their radius; the long sides' arc radius is derived so each corner is inset
// diagonally (45°) from the notional rectangle's corner.
//
// Construction: each corner is at (longDim/2 − s, shortDim/2 − s) for a single inset
// amount s — i.e. displaced inward by equal amounts on both axes, not necessarily
// landing on the 45° line through the overall centre (those only coincide when
// Dx=Dy). s falls out of requiring the short-side arc (radius = shortDim, centred on
// the short axis's centreline) to pass through both its own midpoint and its two
// adjacent corners — a closed form, independent of the long dimension:
//   s = shortDim · (3 − √7) / 4
// The long-side arc's radius is then whatever makes it pass through the long-side's
// midpoint and the same corners:
//   R_long = [(longDim/2 − s)² + s²] / (2s)
//
// Each arc's centre is known explicitly (see below) and used to compute the correct
// SVG sweep flag directly — radius+endpoints alone don't reliably select the intended
// one of the two possible circles (see the note in reuleauxPolygon.ts).

import type { ArcSegment, PolygonOutline } from "./reuleauxPolygon";
import { sweepForKnownCenter } from "./reuleauxPolygon";

export function rectangleOutline(
  Dx: number,
  Dy: number,
  cx: number,
  cy: number,
  reversed = false,
): PolygonOutline {
  const wide = Dx >= Dy;
  const longDim = wide ? Dx : Dy;
  const shortDim = wide ? Dy : Dx;

  const s = (shortDim * (3 - Math.sqrt(7))) / 4;
  const longHalf = longDim / 2 - s;
  const shortHalf = shortDim / 2 - s;
  const longRadius = (longHalf * longHalf + s * s) / (2 * s);

  // Build in "wide" canonical orientation (long axis = X).
  const topMid = { x: 0, y: -shortDim / 2 };
  const bottomMid = { x: 0, y: shortDim / 2 };
  const leftMid = { x: -longDim / 2, y: 0 };
  const rightMid = { x: longDim / 2, y: 0 };
  const cornerTR = { x: longHalf, y: -shortHalf };
  const cornerBR = { x: longHalf, y: shortHalf };
  const cornerBL = { x: -longHalf, y: shortHalf };
  const cornerTL = { x: -longHalf, y: -shortHalf };

  const leftCenter = { x: shortDim - longDim / 2, y: 0 };
  const rightCenter = { x: longDim / 2 - shortDim, y: 0 };
  const topCenter = { x: 0, y: longRadius - shortDim / 2 };
  const bottomCenter = { x: 0, y: shortDim / 2 - longRadius };

  const points = [leftMid, cornerTL, topMid, cornerTR, rightMid, cornerBR, bottomMid, cornerBL];
  const radii = [shortDim, longRadius, longRadius, shortDim, shortDim, longRadius, longRadius, shortDim];
  const centers = [leftCenter, topCenter, topCenter, rightCenter, rightCenter, bottomCenter, bottomCenter, leftCenter];

  const toScreen = (p: { x: number; y: number }) =>
    wide ? { x: cx + p.x, y: cy + p.y } : { x: cx + p.y, y: cy + p.x };

  const screenPoints = points.map(toScreen);
  const screenCenters = centers.map(toScreen);

  const count = points.length;
  const order = reversed ? Array.from({ length: count }, (_, i) => count - i) : Array.from({ length: count }, (_, i) => i);

  const arcs: ArcSegment[] = [];
  for (let step = 0; step < count; step++) {
    const i = ((order[step] % count) + count) % count;
    const j = ((order[step + 1] ?? order[0]) % count + count) % count;
    const from = screenPoints[i];
    const to = screenPoints[j];
    // The centre belongs to whichever of the two original (pre-reversal) edges this
    // is — i.e. the edge index is min(i,j) when traversed forward, so just reuse the
    // forward edge's centre/radius (edge k connects points[k] to points[k+1]).
    const edgeIndex = reversed ? j : i;
    arcs.push({ to, radius: radii[edgeIndex], sweep: sweepForKnownCenter(from, to, radii[edgeIndex], screenCenters[edgeIndex]) });
  }
  return { start: screenPoints[((order[0] % count) + count) % count], arcs };
}
