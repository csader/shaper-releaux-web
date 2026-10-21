// Extracts candidate guide curves (open paths, e.g. a swan-neck pediment's edge) from
// an uploaded SVG, for the molding tool. Deliberately simpler than parseSvg.ts's
// parseCandidateLoops: it treats each shape element as a single ordered point
// sequence with no self-intersection/hole-containment validation (that machinery is
// specific to closed, fillable shapes and doesn't apply to an open guide curve), and
// does not split multi-subpath <path> elements (a single <path> with several M-
// separated subpaths is sampled as one combined candidate — see the plan's "out of
// scope" notes).
//
// DOM-dependent (SVGGeometryElement, getCTM) — not unit-tested under vitest's default
// Node environment; verified via manual browser testing instead, same carve-out
// parseSvg.ts already documents for parseCandidateLoops.

import type { Point } from "../geometry/customShape";
import { matrixPoint, sampleGeometryElement } from "./sampleGeometry";

export interface PathCandidate {
  id: string;
  points: Point[];
  /** Polyline length in the SVG's own user units (pre-scale) — used for the
   * auto-suggest heuristic (longest = most likely the intended guide curve). */
  lengthMm: number;
}

const SHAPE_SELECTOR = "path, polyline, polygon, line, rect, circle, ellipse";
// Higher than parseCandidateLoops' 200 — no O(n²) self-intersection/containment
// checks here, and denser sampling improves tangent/normal accuracy along the curve.
const MAX_POINTS = 400;
export const MAX_CANDIDATES = 40;

function polylineLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/**
 * Parses an uploaded SVG's text content into candidate open guide curves, each
 * already transformed into the root `<svg>`'s coordinate space (ancestor group
 * transforms, nested viewBoxes, etc. all resolved via the browser's own getCTM()).
 */
export function parseOpenPathCandidates(svgText: string): PathCandidate[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Could not parse this file as SVG.");

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") {
    throw new Error("No <svg> root element found.");
  }

  // Must live in the document for getCTM()/getPointAtLength() to behave consistently
  // across browsers, so inject off-screen rather than operating on the detached doc.
  const container = document.createElement("div");
  container.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;";
  document.body.appendChild(container);

  const imported = document.importNode(root, true) as unknown as SVGSVGElement;
  container.appendChild(imported);

  const candidates: PathCandidate[] = [];
  let counter = 0;

  try {
    const elements = Array.from(imported.querySelectorAll(SHAPE_SELECTOR)) as SVGGeometryElement[];
    for (const el of elements) {
      if (candidates.length > MAX_CANDIDATES) break;
      const ctm = el.getCTM();
      if (!ctm) continue;

      const localPoints = sampleGeometryElement(el, MAX_POINTS);
      if (localPoints.length < 2) continue;
      const points = localPoints.map((p) => matrixPoint(ctm, p.x, p.y));
      candidates.push({ id: `candidate-${counter++}`, points, lengthMm: polylineLength(points) });
    }
  } finally {
    document.body.removeChild(container);
  }

  return candidates;
}
