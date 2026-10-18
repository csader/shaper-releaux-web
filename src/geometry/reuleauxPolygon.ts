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

const toRad = (deg: number) => (deg * Math.PI) / 180;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = toRad(angleDeg);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** True Reuleaux polygon for odd n ≥ 3. D is the overall width (= arc radius). */
function oddReuleauxOutline(n: number, D: number, cx: number, cy: number, sweep: 0 | 1): PolygonOutline {
  const k = (n - 1) / 2;
  const Rc = D / (2 * Math.sin((k * Math.PI) / n));
  // Point down: one vertex at angle 90° (screen-down), spaced 360/n apart.
  const vertices = Array.from({ length: n }, (_, i) => polar(cx, cy, Rc, 90 + (360 * i) / n));
  const oppositeOffset = (n + 1) / 2;
  const arcs: ArcSegment[] = [];
  for (let i = 0; i < n; i++) {
    const to = vertices[(i + 1) % n];
    arcs.push({ to, radius: D, sweep });
  }
  // oppositeOffset isn't needed for drawing (radius alone + sweep flag determines the
  // arc given SVG's two-point-plus-radius representation); kept for documentation/tests.
  void oppositeOffset;
  return { start: vertices[0], arcs };
}

/** Radiused polygon for even n ≥ 4. D is the overall width (= arc radius). */
function evenRadiusedOutline(n: number, D: number, cx: number, cy: number, sweep: 0 | 1): PolygonOutline {
  const R2 = D / 2; // midpoint radius
  const thetaDeg = (180 * (n - 1)) / n;
  const cosT = Math.cos(toRad(thetaDeg));
  const r1Ratio = (cosT + Math.sqrt(cosT * cosT + 3)) / 2;
  const R1 = D * r1Ratio; // corner radius

  // 2n points alternating: midpoint, corner, midpoint, corner, ... starting at angle
  // 90° (pointing down) for a midpoint, matching the odd-n orientation convention.
  const halfStep = 180 / n;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const midAngle = 90 + (360 * i) / n;
    points.push(polar(cx, cy, R2, midAngle));
    points.push(polar(cx, cy, R1, midAngle + halfStep));
  }

  const arcs: ArcSegment[] = [];
  for (let i = 0; i < 2 * n; i++) {
    const to = points[(i + 1) % (2 * n)];
    arcs.push({ to, radius: D, sweep });
  }
  return { start: points[0], arcs };
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
  return n % 2 === 1
    ? oddReuleauxOutline(n, D, cx, cy, sweep)
    : evenRadiusedOutline(n, D, cx, cy, sweep);
}

/** Circumradius of the odd-n regular polygon of width D — used for centre-offset math. */
export function oddCircumradius(n: number, D: number): number {
  const k = (n - 1) / 2;
  return D / (2 * Math.sin((k * Math.PI) / n));
}
