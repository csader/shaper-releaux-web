// Custom imported SVG shapes: a polyline-based parallel path to the arc-based native
// shapes (reuleauxPolygon.ts / heart.ts / rectangle.ts), which are left untouched.
// Every ring in this engine is already "the same base silhouette, uniformly scaled
// toward a fixed center" — confirmed against real sample output for the native
// shapes, not a simplification introduced here. An imported shape (with or without
// holes) follows the exact same convention: holes scale together with the outer
// boundary at the same factor, so a hole safely contained at full size stays safely
// contained at every smaller ring (relative containment is scale-invariant under a
// uniform scale from one fixed center).

export type Point = { x: number; y: number };
export type Loop = Point[]; // closed polygon, points in order, NOT duplicated at the end

export interface CompoundShape {
  /** Normalized: centroid at (0,0), outer loop's bounding-box width = 1. */
  outer: Loop;
  holes: Loop[];
}

/** Shoelace signed area (positive = counterclockwise in standard math orientation;
 * sign flips in SVG's y-down space, but only the *relative* sign between loops
 * matters here, so that's not tracked separately). */
export function signedArea(loop: Loop): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/** True area-weighted centroid (not the mean of vertices, which is wrong for a
 * non-uniform point distribution along the boundary). */
export function polygonCentroid(loop: Loop): { x: number; y: number; area: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    const cross = a.x * b.y - b.x * a.y;
    area += cross;
    cx += (a.x + b.x) * cross;
    cy += (a.y + b.y) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-12) return { x: loop[0]?.x ?? 0, y: loop[0]?.y ?? 0, area: 0 };
  return { x: cx / (6 * area), y: cy / (6 * area), area };
}

/** Composite centroid of outer-minus-holes, area-weighted. Falls back to the outer
 * loop's own centroid (and reports `fellBack: true`) if the composite centroid lands
 * outside the outer-minus-holes region — can happen for extreme crescent shapes. */
export function centroidWithHoles(
  outer: Loop,
  holes: Loop[],
): { x: number; y: number; fellBack: boolean } {
  const outerC = polygonCentroid(outer);
  const outerArea = Math.abs(outerC.area);
  let numX = outerC.x * outerArea;
  let numY = outerC.y * outerArea;
  let denom = outerArea;
  for (const hole of holes) {
    const holeC = polygonCentroid(hole);
    const holeArea = Math.abs(holeC.area);
    numX -= holeC.x * holeArea;
    numY -= holeC.y * holeArea;
    denom -= holeArea;
  }
  if (denom <= 1e-9) return { x: outerC.x, y: outerC.y, fellBack: true };
  const composite = { x: numX / denom, y: numY / denom };
  if (!pointInPolygon(composite, outer) || holes.some((h) => pointInPolygon(composite, h))) {
    const bbox = boundingBox(outer);
    return { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2, fellBack: true };
  }
  return { ...composite, fellBack: false };
}

export function boundingBox(loop: Loop): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of loop) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, maxX, minY, maxY };
}

export function pointInPolygon(point: Point, loop: Loop): boolean {
  let inside = false;
  for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
    const pi = loop[i];
    const pj = loop[j];
    const intersects = pi.y > point.y !== pj.y > point.y && point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return false; // parallel (ignores exact-overlap edge case)
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  const eps = 1e-9;
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
}

/** O(n²) self-intersection check — fine at the point counts this app uses (capped
 * ~150-200 per loop). Skips adjacent segments, which legitimately share an endpoint. */
export function isSimplePolygon(loop: Loop): boolean {
  const n = loop.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) {
    const a1 = loop[i];
    const a2 = loop[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      if (j === i) continue;
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) continue;
      const b1 = loop[j];
      const b2 = loop[(j + 1) % n];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/** A hole must be fully inside the outer loop and not cross its boundary. */
export function holeIsContained(hole: Loop, outer: Loop): boolean {
  if (!hole.every((p) => pointInPolygon(p, outer))) return false;
  const n = hole.length;
  const m = outer.length;
  for (let i = 0; i < n; i++) {
    const a1 = hole[i];
    const a2 = hole[(i + 1) % n];
    for (let j = 0; j < m; j++) {
      const b1 = outer[j];
      const b2 = outer[(j + 1) % m];
      if (segmentsIntersect(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/** Minimum distance from any point of `loop` to the boundary of `other` — a cheap
 * (not exact edge-to-edge) approximation used only for the narrow-gap warning. */
export function minVertexDistanceToPolygon(loop: Loop, other: Loop): number {
  let min = Infinity;
  for (const p of loop) {
    for (let j = 0; j < other.length; j++) {
      const a = other[j];
      const b = other[(j + 1) % other.length];
      min = Math.min(min, distanceToSegment(p, a, b));
    }
  }
  return min;
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

/** Normalizes raw (SVG-space) points into the storage convention: centroid at
 * (0,0), outer loop's bounding-box width = 1. */
export function normalizeShape(outer: Loop, holes: Loop[]): CompoundShape {
  const centroid = centroidWithHoles(outer, holes);
  const shift = (loop: Loop): Loop => loop.map((p) => ({ x: p.x - centroid.x, y: p.y - centroid.y }));
  const shiftedOuter = shift(outer);
  const shiftedHoles = holes.map(shift);
  const bbox = boundingBox(shiftedOuter);
  const width = bbox.maxX - bbox.minX || 1;
  const scale = (loop: Loop): Loop => loop.map((p) => ({ x: p.x / width, y: p.y / width }));
  return { outer: scale(shiftedOuter), holes: shiftedHoles.map(scale) };
}

/** Scales the normalized shape to overall width D, placed at (cx, cy). */
export function scaleCompoundShape(shape: CompoundShape, D: number, cx: number, cy: number): CompoundShape {
  const apply = (loop: Loop): Loop => loop.map((p) => ({ x: cx + p.x * D, y: cy + p.y * D }));
  return { outer: apply(shape.outer), holes: shape.holes.map(apply) };
}

function loopToPathFragment(loop: Loop, reverse: boolean): string {
  const pts = reverse ? [...loop].reverse() : loop;
  const parts = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${round(p.x)},${round(p.y)}`);
  parts.push("Z");
  return parts.join(" ");
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

/**
 * Builds the SVG path `d` string for a (already scaled) compound shape: the outer
 * loop in its natural winding, holes in the opposite winding (the standard even-odd
 * "hole" trick — the same mechanism already used for the roughing pocket's
 * stock-boundary/kept-shape pair, just generalized to more than one subpath).
 * `reversed` flips the whole thing's role (outer<->hole winding), for contexts that
 * need this shape's winding opposite to its normal standalone rendering.
 */
export function compoundShapeToPathData(shape: CompoundShape, reversed = false): string {
  const outerFragment = loopToPathFragment(shape.outer, reversed);
  const holeFragments = shape.holes.map((h) => loopToPathFragment(h, !reversed));
  return [outerFragment, ...holeFragments].join(" ");
}
