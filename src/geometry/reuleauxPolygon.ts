// Constant-width / radiused polygon outlines, parametrized purely by the number of
// sides (n) and the overall "width" D (which is also the shared arc radius — this
// holds for every n, odd or even, confirmed against real sample output).
//
// Odd n (3, 5, 7) — true Reuleaux polygon: a regular n-gon; each edge's arc is
// centered on the vertex (n+1)/2 steps away ("the opposite vertex"). Verified exactly
// against a real 5-sided bowl's vertex coordinates.
//
// Even n (4, 6) — "radiused" polygon: 2n points alternating corners and side
// midpoints. Midpoints sit at radius D/2; corners sit at radius
// D·[cosθ + √(cos²θ+3)] / 2 where θ = 180(n−1)/n°. Each of the 2n edges (corner↔
// adjacent midpoint) is an arc of radius D centered on the *opposite* midpoint.
// Derived algebraically (law of cosines + the radius-D edge constraint) and checked
// against a real square bowl's measured corner radius (match to 4 sig figs).
//
// IMPORTANT: radius + endpoints alone are ambiguous — there are always two circles of
// a given radius through two given points, and naively picking sweep=0 (or 1) doesn't
// reliably select the one centered on the *intended* point. An earlier version of this
// file assumed it did; it happened to look plausible for pentagon/heptagon (large D
// relative to the chord) but produced a visibly wrong concave shape for the triangle,
// where the chord equals the radius. Fixed by explicitly computing, per arc, which
// sweep value actually centers the SVG arc on the known intended centre (see
// `sweepForKnownCenter` below) rather than assuming one.

export interface ArcSegment {
  /** Point this arc sweeps to (the path's start point is the previous segment's end). */
  to: { x: number; y: number };
  /** Circular radius. For elliptical arcs (the heart's big lower arcs) set rx/ry instead. */
  radius?: number;
  rx?: number;
  ry?: number;
  /** SVG arc sweep flag (0 or 1) — direction of the bulge. */
  sweep: 0 | 1;
}

export interface PolygonOutline {
  start: { x: number; y: number };
  arcs: ArcSegment[];
}

type Point = { x: number; y: number };

const toRad = (deg: number) => (deg * Math.PI) / 180;

function polar(cx: number, cy: number, r: number, angleDeg: number): Point {
  const a = toRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/**
 * Given two arc endpoints, a radius, and the known intended centre, returns the SVG
 * sweep-flag (0 or 1, with large-arc-flag=0) that actually centers the arc there.
 * Calibrated empirically against real browser SVG rendering (getPointAtLength), not
 * derived from the spec by hand — see the session notes: for the candidate
 * `M + u·h` (u = perpendicular unit vector (-dy/d, dx/d)), sweep=1 selects it;
 * `M - u·h` is selected by sweep=0.
 */
export function sweepForKnownCenter(from: Point, to: Point, radius: number, center: Point): 0 | 1 {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.hypot(dx, dy);
  const h = Math.sqrt(Math.max(radius * radius - (d / 2) ** 2, 0));
  const ux = -dy / d;
  const uy = dx / d;
  const plus = { x: mx + ux * h, y: my + uy * h };
  const minus = { x: mx - ux * h, y: my - uy * h };
  const distPlus = Math.hypot(plus.x - center.x, plus.y - center.y);
  const distMinus = Math.hypot(minus.x - center.x, minus.y - center.y);
  return distPlus < distMinus ? 1 : 0;
}

/**
 * True Reuleaux polygon for odd n ≥ 3. D is the overall width (= arc radius).
 * `reversed` traces the same shape in the opposite winding direction (for contexts
 * needing the opposite fill-rule orientation, e.g. a pocket's inner "kept" subpath).
 */
function oddReuleauxOutline(n: number, D: number, cx: number, cy: number, reversed: boolean): PolygonOutline {
  const k = (n - 1) / 2;
  const Rc = D / (2 * Math.sin((k * Math.PI) / n));
  const vertices = Array.from({ length: n }, (_, i) => polar(cx, cy, Rc, 90 + (360 * i) / n));
  const oppositeOffset = (n + 1) / 2;
  const order = reversed ? Array.from({ length: n }, (_, i) => n - i) : Array.from({ length: n }, (_, i) => i);

  const arcs: ArcSegment[] = [];
  for (let step = 0; step < n; step++) {
    const i = ((order[step] % n) + n) % n;
    const j = ((order[step + 1] ?? order[0]) % n + n) % n;
    const from = vertices[i];
    const to = vertices[j];
    // Edge k connects vertices[k] -> vertices[(k+1)%n]; when reversed, the pair
    // (i,j) traces that same undirected edge with k=j (not i) — see rectangle.ts
    // for the derivation of why this holds for a "count - i" reversal.
    const edgeIndex = reversed ? j : i;
    const center = vertices[(edgeIndex + oppositeOffset) % n];
    const sweep = sweepForKnownCenter(from, to, D, center);
    arcs.push({ to, radius: D, sweep });
  }
  return { start: vertices[((order[0] % n) + n) % n], arcs };
}

/** Radiused polygon for even n ≥ 4. D is the overall width (= arc radius). */
function evenRadiusedOutline(n: number, D: number, cx: number, cy: number, reversed: boolean): PolygonOutline {
  const R2 = D / 2; // midpoint radius
  const thetaDeg = (180 * (n - 1)) / n;
  const cosT = Math.cos(toRad(thetaDeg));
  const r1Ratio = (cosT + Math.sqrt(cosT * cosT + 3)) / 2;
  const R1 = D * r1Ratio; // corner radius

  // 2n points alternating: midpoint, corner, midpoint, corner, ... starting at angle
  // 90° (pointing down) for a midpoint, matching the odd-n orientation convention.
  const halfStep = 180 / n;
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const midAngle = 90 + (360 * i) / n;
    points.push(polar(cx, cy, R2, midAngle));
    points.push(polar(cx, cy, R1, midAngle + halfStep));
  }
  const count = 2 * n;
  // Each edge touches exactly one midpoint (even index); its centre is the opposite
  // midpoint, n steps away in this 2n-point cycle.
  const centerFor = (i: number, j: number): Point => {
    const midpointIndex = i % 2 === 0 ? i : j;
    return points[(midpointIndex + n) % count];
  };

  const order = reversed
    ? Array.from({ length: count }, (_, i) => count - i)
    : Array.from({ length: count }, (_, i) => i);

  const arcs: ArcSegment[] = [];
  for (let step = 0; step < count; step++) {
    const i = ((order[step] % count) + count) % count;
    const j = ((order[step + 1] ?? order[0]) % count + count) % count;
    const from = points[i];
    const to = points[j];
    const center = centerFor(i, j);
    const sweep = sweepForKnownCenter(from, to, D, center);
    arcs.push({ to, radius: D, sweep });
  }
  return { start: points[((order[0] % count) + count) % count], arcs };
}

/**
 * Outline for `n` sides (3–7) with overall width `D`, centered at (cx, cy).
 * n=1 (ellipse) and n=2 (heart) are handled by separate modules — this only covers
 * the polygon-family shapes (3, 4, 5, 6, 7).
 */
export function reuleauxPolygonOutline(
  n: 3 | 4 | 5 | 6 | 7,
  D: number,
  cx: number,
  cy: number,
  sweep: 0 | 1 = 0,
): PolygonOutline {
  const reversed = sweep === 1;
  return n % 2 === 1
    ? oddReuleauxOutline(n, D, cx, cy, reversed)
    : evenRadiusedOutline(n, D, cx, cy, reversed);
}

/** Circumradius of the odd-n regular polygon of width D — used for centre-offset math. */
export function oddCircumradius(n: number, D: number): number {
  const k = (n - 1) / 2;
  return D / (2 * Math.sin((k * Math.PI) / n));
}
