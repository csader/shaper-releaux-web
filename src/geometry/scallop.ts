// Scallop (cusp) height: the ridge left between two adjacent finishing passes cut
// with a ball-nose bit, stepped over by `mmCut`. Depends on the bit's radius, not
// just mmCut — a smaller-diameter ball bit leaves a rougher finish at the same
// mmCut than a larger one, since a bigger ball blends over a wider span. Standard
// CNC formula (exact, not the small-stepover approximation h ≈ mmCut²/(8·radius)):
// for two circular arcs of radius r whose centers are mmCut apart, the remaining
// cusp height is r minus the vertical distance down to where those arcs cross.

export function scallopHeight(bitDiameterMm: number, mmCut: number): number | null {
  const radius = bitDiameterMm / 2;
  if (mmCut >= bitDiameterMm) return null; // stepover exceeds the bit's own diameter — leaves gaps, not just a rough finish
  const half = mmCut / 2;
  return radius - Math.sqrt(Math.max(radius * radius - half * half, 0));
}
