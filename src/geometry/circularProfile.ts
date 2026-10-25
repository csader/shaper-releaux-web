// Circular interior profile — an alternative to the default elliptical one, per the
// original author's own forum description: "The profile follows the circumference of
// a circle centred above the workpiece" (vs. the elliptical profile's "half the
// circumference of an ellipse with major and minor radii equal to the radius of the
// bowl and the depth of the bowl" — which is exactly the existing default formula).
// He describes circular as "best suited to shallow carves" and switched to
// elliptical for bowls generally, for the lip's more vertical edges — so this is
// offered as a selectable alternative, not a new default.
//
// It's the same circle used by the Chord tool's groove formula (geometry/chord.ts):
// a circle centred above the workpiece, radius chosen so it passes through the
// pocket's deepest point (radius=0, depth=innerDepth) and both rim edges
// (radius=±halfWidth, depth=0). Parametrized by θ exactly like the elliptical profile
// (0 at center, 90 at the rim) by sweeping the circle's own angle α from straight-down
// (θ=0) to wherever it reaches the rim (θ=90), then reusing chordDepthAt directly for
// Z — no need to re-derive the circle equation, it's the identical shape.
//
// NOTE on the `R` field: despite the name, ProfileCurve's R is the full DIAMETER at
// that angle (confirmed against interiorDiameter/exteriorDiameter in profile.ts,
// which return innerDiameter·sin(θ) — reaching the full innerDiameter at θ=90, not
// innerDiameter/2) — chord.ts's halfWidth/chordDepthAt deal in true radius-like
// offsets-from-center, so the internal radius `r` is doubled before being returned.

import { chordDepthAt, chordRadius } from "./chord";
import type { ProfileCurve } from "./profile";

export function circularInteriorProfile(
  innerDiameter: number,
  innerDepth: number,
  outerDepth: number,
  zTouchHeight: number,
): ProfileCurve {
  const halfWidth = innerDiameter / 2;
  const offset = outerDepth - zTouchHeight;
  if (innerDepth <= 0) return () => ({ R: 0, Z: -offset });

  const rc = chordRadius(halfWidth, innerDepth);
  const alphaMax = Math.asin(Math.min(1, halfWidth / rc));

  return (theta) => {
    const alpha = (theta / 90) * alphaMax;
    const r = rc * Math.sin(alpha);
    return { R: r * 2, Z: chordDepthAt(r, halfWidth, innerDepth, "concave") - offset };
  };
}
