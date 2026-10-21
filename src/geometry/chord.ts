// Chord / groove depth math, from the original app's "Chord calculations" reference
// (used for straight decorative flutes/grooves, e.g. fluted door staves — distinct
// from the bowl's sin/cos profile). A groove of surface width 2W and center depth Z
// is modeled as a circular arc: the unique circle that passes through both surface
// edges of the groove (at depth 0, offset ±W from center) and the groove's own
// deepest point (at depth Z, offset 0). Solving for that circle's radius from those
// three points gives R = (W² + Z²) / (2Z). At any offset X from the groove's
// centerline (|X| <= W), the cut depth is the vertical distance from the surface down
// to that circle: D(X) = sqrt(R² - X²) - (R - Z).

export function chordRadius(halfWidthMm: number, depthMm: number): number {
  return (halfWidthMm * halfWidthMm + depthMm * depthMm) / (2 * depthMm);
}

export function chordDepthAt(xMm: number, halfWidthMm: number, depthMm: number): number {
  const r = chordRadius(halfWidthMm, depthMm);
  const raw = Math.sqrt(Math.max(r * r - xMm * xMm, 0)) - (r - depthMm);
  // Clamped rather than left to go negative beyond the groove's edge (the formula is
  // only valid for |X| <= halfWidth; past it "depth" would mean above the surface).
  return Math.max(raw, 0);
}
