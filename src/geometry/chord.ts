// Chord / groove depth math, from the original app's "Chord calculations" reference
// (used for straight decorative flutes/grooves, e.g. fluted door staves — distinct
// from the bowl's sin/cos profile). A groove of surface width 2W and center depth Z
// is modeled as a circular arc: the unique circle that passes through both surface
// edges of the groove (at depth 0, offset ±W from center) and the groove's own
// deepest point (at depth Z, offset 0). Solving for that circle's radius from those
// three points gives R = (W² + Z²) / (2Z). At any offset X from the groove's
// centerline (|X| <= W), the concave cut depth is the vertical distance from the
// surface down to that circle: D(X) = sqrt(R² - X²) - (R - Z).
//
// "Convex" (the woodworking term is reeding, vs. fluting for concave) is the same
// circle, just read the other way: instead of a valley that's deepest at the center
// and bottoms out at the surface at the edges, it's a raised bead that peaks at the
// center (no material removed there at all) and is cut down to depth Z at the edges —
// exactly the complement, D_convex(X) = Z - D_concave(X). Adjacent convex passes at
// pitch == groove width butt edge-to-edge with no flat step between them, since each
// one reaches the same depth Z right where the next one starts.
//
// "Ogee" (a cyma — the classic S-shaped molding profile) isn't a circular arc at all,
// so chordRadius doesn't apply to it. Instead of a dish or a bead (both symmetric
// about the centerline), it's a smooth monotonic RAMP from depth 0 at one edge
// (X = -halfWidth) to depth Z at the other (X = +halfWidth), whose curvature sign
// flips at the midpoint — concave near one edge, convex near the other — which is
// exactly what reads visually as an S. A raised cosine does this cleanly: zero slope
// at both endpoints (meets flat stock tangentially, no sharp corner) and an inflection
// at the center.

export type ChordProfile = "concave" | "convex" | "ogee";

export function chordRadius(halfWidthMm: number, depthMm: number): number {
  return (halfWidthMm * halfWidthMm + depthMm * depthMm) / (2 * depthMm);
}

export function chordDepthAt(
  xMm: number,
  halfWidthMm: number,
  depthMm: number,
  profile: ChordProfile = "concave",
): number {
  if (profile === "ogee") {
    const t = Math.min(1, Math.max(0, (xMm + halfWidthMm) / (2 * halfWidthMm)));
    return (depthMm / 2) * (1 - Math.cos(Math.PI * t));
  }
  const r = chordRadius(halfWidthMm, depthMm);
  const raw = Math.sqrt(Math.max(r * r - xMm * xMm, 0)) - (r - depthMm);
  // Clamped rather than left to go negative beyond the groove's edge (the formula is
  // only valid for |X| <= halfWidth; past it "depth" would mean above the surface).
  const concaveDepth = Math.max(raw, 0);
  return profile === "concave" ? concaveDepth : depthMm - concaveDepth;
}
