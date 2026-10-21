// Shared SVG geometry sampling: walks any SVGGeometryElement via the browser's own
// getPointAtLength (so beziers/arcs are flattened correctly without reimplementing
// curve math) and transforms raw local points into a target coordinate space via a
// DOMMatrix. Used by both the closed-loop shape importer (parseSvg.ts, for the bowl's
// custom outline upload) and the open-path guide-curve importer (parseOpenPath.ts,
// for the molding tool) — same sampling need, different validation downstream.
//
// DOM-dependent (SVGGeometryElement, getPointAtLength, DOMMatrix/DOMPoint) — not
// unit-tested under vitest's default Node environment; verified via manual browser
// testing instead, same carve-out parseSvg.ts already documents.

const MIN_ARC_LENGTH_STEP = 0.5; // in the element's own user units

export function matrixPoint(m: DOMMatrix, x: number, y: number): { x: number; y: number } {
  const p = new DOMPoint(x, y).matrixTransform(m);
  return { x: p.x, y: p.y };
}

export function sampleGeometryElement(el: SVGGeometryElement, maxPoints: number): { x: number; y: number }[] {
  const total = el.getTotalLength();
  if (!Number.isFinite(total) || total < 1e-6) return [];
  const step = Math.max(MIN_ARC_LENGTH_STEP, total / maxPoints);
  const count = Math.min(maxPoints, Math.max(8, Math.ceil(total / step)));
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const len = (total * i) / count;
    const p = el.getPointAtLength(len);
    points.push({ x: p.x, y: p.y });
  }
  return points;
}
