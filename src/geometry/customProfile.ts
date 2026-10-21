// Hand-drawn alternative to the parametric elliptical profile formulas in profile.ts
// — lets a user define the bowl's cross-section (radius vs. depth) by placing points,
// instead of being limited to the fixed sine/cosine shape. Plugs into the exact same
// ProfileCurve interface that stepAngles already consumes, so the radial/
// circumferential/hybrid stepping engine works on a custom curve unmodified — it only
// ever calls curve(t) and takes finite differences, with no trig or degree-specific
// logic baked in.

import type { ProfileCurve } from "./profile";

export interface ProfilePoint {
  /** 0 = center (interior) or foot (exterior); 1 = rim. Must strictly increase along points[]. */
  r: number;
  /** 0 = shallow/rim-level; 1 = full depth. Must be monotonic (one direction) along points[]. */
  z: number;
}

export interface CustomProfile {
  points: ProfilePoint[];
}

/**
 * Monotonic cubic Hermite interpolation (Fritsch-Carlson) through `values` indexed by
 * `xs` (xs strictly increasing), at parameter x. Unlike a plain Catmull-Rom spline,
 * this is guaranteed not to overshoot/oscillate between monotonic input points — a
 * real requirement here, not just a smoothness nicety: a bit cutting from directly
 * above can't undercut, so a wobble that reversed direction between two control
 * points would describe a physically uncuttable profile.
 */
function monotoneCubicAt(xs: number[], values: number[], x: number): number {
  const n = xs.length;
  if (n === 1) return values[0];
  const clampedX = Math.min(Math.max(x, xs[0]), xs[n - 1]);

  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((values[i + 1] - values[i]) / (xs[i + 1] - xs[i]));

  const m: number[] = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] + d[i]) / 2;

  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    if (a < 0) m[i] = 0;
    if (b < 0) m[i + 1] = 0;
    const sq = a * a + b * b;
    if (sq > 9) {
      const tau = 3 / Math.sqrt(sq);
      m[i] = tau * a * d[i];
      m[i + 1] = tau * b * d[i];
    }
  }

  let seg = 0;
  while (seg < n - 2 && clampedX > xs[seg + 1]) seg++;
  const h = xs[seg + 1] - xs[seg];
  const t = h === 0 ? 0 : (clampedX - xs[seg]) / h;
  const t2 = t * t;
  const t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;
  return h00 * values[seg] + h10 * h * m[seg] + h01 * values[seg + 1] + h11 * h * m[seg + 1];
}

/** Evaluates the curve at t in [0,1] (0 = first point, 1 = last point), returning
 * normalized {r, z} in [0,1] — interpolated independently per-axis against a shared
 * point-index parameter, each via the monotonicity-preserving interpolant above. */
export function evaluateCustomProfile(profile: CustomProfile, t: number): { r: number; z: number } {
  const n = profile.points.length;
  const idx = profile.points.map((_, i) => i);
  const clampedT = Math.min(Math.max(t, 0), 1);
  const s = clampedT * (n - 1);
  const rs = profile.points.map((p) => p.r);
  const zs = profile.points.map((p) => p.z);
  return {
    r: monotoneCubicAt(idx, rs, s),
    z: monotoneCubicAt(idx, zs, s),
  };
}

/**
 * Adapts a CustomProfile into the standard ProfileCurve interface (t in [0,90], to
 * stay consistent with the existing stepping engine's domain — it's just a label,
 * stepAngles has no degree-specific logic), scaled to real mm. `maxDiameter` matches
 * this app's existing convention (interiorDiameter/exteriorDiameter already return
 * full diameter, not radius). `offset` is the same (outerDepth − zTouchHeight) term
 * the parametric formulas subtract, so a custom profile responds to the Z-touch-
 * height setting exactly the way the built-in ones do.
 */
export function toProfileCurve(
  profile: CustomProfile,
  maxDiameter: number,
  maxDepth: number,
  offset: number,
): ProfileCurve {
  return (theta: number) => {
    const { r, z } = evaluateCustomProfile(profile, theta / 90);
    return { R: r * maxDiameter, Z: z * maxDepth - offset };
  };
}
