// Bowl cross-section ("meridian") math: for a given angle θ (0° = straight down to
// centre, 90° = horizontal to the lip), returns the in-plane radius/diameter R(θ) and
// the cut depth Z(θ) relative to the Z-touch reference. Formulas confirmed exactly
// (to 5 decimal places) against both the author's spreadsheet and a real bowl's SVG.

const toRad = (deg: number) => (deg * Math.PI) / 180;

export interface BowlParams {
  outerDiameter: number;
  outerDepth: number;
  innerDiameter: number;
  innerDepth: number;
  footHeight: number;
  footDiameter: number;
  zTouchHeight: number;
}

export function footAngleDeg(outerDiameter: number, footDiameter: number): number {
  return (Math.asin(footDiameter / outerDiameter) * 180) / Math.PI;
}

export function interiorDiameter(theta: number, innerDiameter: number): number {
  return innerDiameter * Math.sin(toRad(theta));
}

export function interiorDepth(
  theta: number,
  innerDepth: number,
  outerDepth: number,
  zTouchHeight: number,
): number {
  return innerDepth * Math.cos(toRad(theta)) - (outerDepth - zTouchHeight);
}

export function exteriorDiameter(theta: number, outerDiameter: number): number {
  return outerDiameter * Math.sin(toRad(theta));
}

export function exteriorDepth(
  theta: number,
  params: Pick<BowlParams, "outerDepth" | "footHeight" | "zTouchHeight">,
  footAngle: number,
): number {
  const { outerDepth, footHeight, zTouchHeight } = params;
  const footRad = toRad(footAngle);
  return (
    outerDepth -
    ((outerDepth - footHeight) / Math.cos(footRad)) * Math.cos(toRad(theta)) -
    (outerDepth - zTouchHeight)
  );
}

/** A profile curve as a plain function of θ (degrees) → {R, Z}. Kept abstract (rather
 * than hardcoding the ellipse formula at every call site) so a different profile source
 * — e.g. extracted from an STL silhouette — could plug into the same stepping/shape
 * engine later without a rewrite. Not built now; just kept cheap to add. */
export type ProfileCurve = (theta: number) => { R: number; Z: number };

export function interiorProfile(
  innerDiameter: number,
  innerDepth: number,
  outerDepth: number,
  zTouchHeight: number,
): ProfileCurve {
  return (theta) => ({
    R: interiorDiameter(theta, innerDiameter),
    Z: interiorDepth(theta, innerDepth, outerDepth, zTouchHeight),
  });
}

export function exteriorProfile(
  outerDiameter: number,
  params: Pick<BowlParams, "outerDepth" | "footHeight" | "zTouchHeight">,
  footAngle: number,
): ProfileCurve {
  return (theta) => ({
    R: exteriorDiameter(theta, outerDiameter),
    Z: exteriorDepth(theta, params, footAngle),
  });
}

export type SteppingModel = "radial" | "circumferential" | "hybrid";

/** Numerical derivative of a profile curve at θ, in units per degree. */
function speedPerDegree(curve: ProfileCurve, theta: number): number {
  const h = 1e-4;
  const a = curve(theta - h);
  const b = curve(theta + h);
  const dR = (b.R - a.R) / (2 * h);
  const dZ = (b.Z - a.Z) / (2 * h);
  return Math.hypot(dR, dZ);
}

/** Arc length (in the R,Z plane) between two angles, via fine sampling. */
function arcLength(curve: ProfileCurve, thetaA: number, thetaB: number, samples = 8): number {
  let total = 0;
  let prev = curve(thetaA);
  for (let i = 1; i <= samples; i++) {
    const t = thetaA + ((thetaB - thetaA) * i) / samples;
    const pt = curve(t);
    total += Math.hypot(pt.R - prev.R, pt.Z - prev.Z);
    prev = pt;
  }
  return total;
}

/**
 * Steps from thetaStart to thetaEnd (inclusive of both ends) using the given
 * cut-distribution model, holding `mmCut` as the target spacing:
 *  - "radial": a single fixed angle increment, sized once from mmCut using the
 *    curve's speed at thetaEnd (the lip — the most forgiving point) — this is the
 *    simpler, documented "radial model" (equal-degree steps).
 *  - "circumferential" (default): adaptively solves for Δθ so the true arc length
 *    between consecutive rings is ≈ mmCut at every step — "the standard model for
 *    all finishing cut SVGs" per the author.
 *  - "hybrid": circumferential, but each step is also grown (never shrunk) so the
 *    ring's actual cut DEPTH changes by at least mmCut too, not just arc length.
 *    Near θ=0 the profile is nearly flat (dZ/dθ≈0 — see interiorDepth/exteriorDepth),
 *    so for a wide, shallow shape most of a circumferential step's arc length there
 *    is radius, not depth, change — producing a dense cluster of rings that are each
 *    correctly mmCut apart along the curve, but barely distinguishable in depth (the
 *    actual motivating case: a ~135mm-wide, ~13mm-deep interior pocket). Targeting
 *    depth directly, rather than flooring against one fixed global angle, only
 *    coarsens exactly the region where depth genuinely isn't moving — everywhere
 *    depth changes at a reasonable rate, hybrid stays as fine as plain
 *    circumferential, which a single global floor couldn't do.
 */
export function stepAngles(
  thetaStart: number,
  thetaEnd: number,
  mmCut: number,
  model: SteppingModel,
  curve: ProfileCurve,
): number[] {
  if (thetaEnd <= thetaStart) return [thetaStart];

  if (model === "radial") {
    const lipSpeed = speedPerDegree(curve, thetaEnd);
    const fixedStep = Math.max(mmCut / lipSpeed, 0.01);
    const thetas: number[] = [];
    let theta = thetaStart;
    while (theta < thetaEnd) {
      thetas.push(theta);
      theta = Math.min(theta + fixedStep, thetaEnd);
    }
    thetas.push(thetaEnd);
    return thetas;
  }

  // Circumferential (and hybrid): adaptive Newton-ish search for Δθ giving
  // arcLength ≈ mmCut.
  const thetas: number[] = [thetaStart];
  let theta = thetaStart;
  while (theta < thetaEnd) {
    let step = mmCut / Math.max(speedPerDegree(curve, theta), 1e-6);
    // Refine: adjust step so the true (sampled) arc length matches mmCut, since the
    // local-derivative estimate drifts over larger steps where curvature is high.
    for (let i = 0; i < 4; i++) {
      const candidateEnd = Math.min(theta + step, thetaEnd);
      const actual = arcLength(curve, theta, candidateEnd);
      if (actual < 1e-9) break;
      step *= mmCut / actual;
    }
    if (model === "hybrid") {
      // If this step's depth change is under mmCut, grow the step (never shrink it
      // below the circumferential value, so hybrid can't be finer than
      // circumferential, only coarser where needed) until it isn't — via bisection,
      // not a proportional/linear correction: near θ=0, dZ/dθ is exactly 0 (a
      // mathematical extremum — see interiorDepth/exteriorDepth), so Z grows
      // quadratically, not linearly, with step size there. A linear correction
      // (`step *= mmCut / zDelta`) badly overshoots in that regime — it was observed
      // jumping the very first step straight to thetaEnd. Bisection has no such
      // assumption; it only relies on Z being monotonic over [theta, thetaEnd],
      // which every profile curve already guarantees (a physically cuttable profile
      // can't reverse direction — see customProfile.ts).
      const candidateEnd = Math.min(theta + step, thetaEnd);
      const zDelta = Math.abs(curve(candidateEnd).Z - curve(theta).Z);
      if (zDelta < mmCut) {
        let lo = step;
        let hi = thetaEnd - theta;
        const hiZDelta = Math.abs(curve(thetaEnd).Z - curve(theta).Z);
        if (hiZDelta >= mmCut) {
          for (let i = 0; i < 20; i++) {
            const mid = (lo + hi) / 2;
            const midZDelta = Math.abs(curve(Math.min(theta + mid, thetaEnd)).Z - curve(theta).Z);
            if (midZDelta < mmCut) lo = mid;
            else hi = mid;
          }
        }
        step = hi; // even reaching thetaEnd without hitting mmCut just means "go there"
      }
    }
    theta = Math.min(theta + step, thetaEnd);
    thetas.push(theta);
  }
  if (thetas[thetas.length - 1] !== thetaEnd) thetas.push(thetaEnd);
  return thetas;
}
