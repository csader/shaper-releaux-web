// Parallel-offset ("molding follows a curved path") math. Operates on an open,
// ordered, already-real-world-mm polyline — a sampled SVG guide curve (e.g. a
// swan-neck pediment's edge). For each point, the local tangent is the central
// difference against its neighbors (clamped to a forward/backward difference at the
// two open ends — same finite-difference idea as profile.ts's speedPerDegree, just
// over a discrete point array instead of a continuous function), and the local
// normal is that tangent rotated +90°. Offsetting every point along its own normal
// by a constant distance approximates a true parallel curve well enough for gentle
// bends; it folds (self-intersects) wherever the offset distance exceeds the path's
// own local radius of curvature — see radiusOfCurvatureAt/minRadiusOfCurvature, which
// exist to warn about that, not prevent it (no fold-cleanup is implemented).

import type { Point } from "./customShape";

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}

function normalize(v: Point): Point {
  const len = Math.hypot(v.x, v.y);
  return len < 1e-9 ? { x: 0, y: 0 } : { x: v.x / len, y: v.y / len };
}

/** Unit tangent at index i: central difference against neighbors, forward/backward
 * difference at the two ends of the open polyline. Zero vector if the neighbors are
 * coincident (degenerate — see dedupeConsecutive). */
export function tangentAt(points: Point[], i: number): Point {
  const n = points.length;
  const prev = points[Math.max(0, i - 1)];
  const next = points[Math.min(n - 1, i + 1)];
  return normalize(sub(next, prev));
}

/** Unit normal at index i: the tangent rotated +90° — (-ty, tx). This fixes a single
 * consistent "side" for a given path winding; a `flipSide` toggle in the tool UI
 * covers guide curves drawn with the opposite winding, rather than requiring the
 * user to re-draw/reverse their SVG. */
export function normalAt(points: Point[], i: number): Point {
  const t = tangentAt(points, i);
  return { x: -t.y, y: t.x };
}

export function offsetPoint(points: Point[], i: number, distanceMm: number): Point {
  const n = normalAt(points, i);
  const p = points[i];
  return { x: p.x + n.x * distanceMm, y: p.y + n.y * distanceMm };
}

export function offsetPolyline(points: Point[], distanceMm: number): Point[] {
  return points.map((_, i) => offsetPoint(points, i, distanceMm));
}

/** Exact circumradius of the circle through three points — Infinity for
 * (near-)collinear points (zero curvature, i.e. "safe at any offset"). */
function triangleCircumradius(a: Point, b: Point, c: Point): number {
  const ab = Math.hypot(b.x - a.x, b.y - a.y);
  const bc = Math.hypot(c.x - b.x, c.y - b.y);
  const ca = Math.hypot(a.x - c.x, a.y - c.y);
  const area2 = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
  return area2 < 1e-9 ? Infinity : (ab * bc * ca) / (2 * area2);
}

/** Local radius of curvature at index i, via the circle through its two neighbors.
 * Offsetting by more than this folds the curve at that point. */
export function radiusOfCurvatureAt(points: Point[], i: number): number {
  if (points.length < 3) return Infinity;
  const n = points.length;
  return triangleCircumradius(points[Math.max(0, i - 1)], points[i], points[Math.min(n - 1, i + 1)]);
}

/** Tightest bend anywhere along the path — the offset distance beyond which the
 * molding's cross-section would fold on itself somewhere. Deliberately conservative
 * (doesn't distinguish which side of a bend the offset falls toward), used as a
 * warning readout, not a hard limit — the geometry is still generated either way. */
export function minRadiusOfCurvature(points: Point[]): number {
  let min = Infinity;
  for (let i = 0; i < points.length; i++) min = Math.min(min, radiusOfCurvatureAt(points, i));
  return min;
}

/** Drops consecutive points closer than epsilonMm — guards tangentAt's degenerate
 * zero-length-segment case (a duplicate point from the SVG sample) from collapsing
 * that point's tangent/normal to zero. */
export function dedupeConsecutive(points: Point[], epsilonMm = 1e-3): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > epsilonMm) out.push(p);
  }
  return out;
}
