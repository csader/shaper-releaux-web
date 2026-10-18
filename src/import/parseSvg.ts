// Extracts candidate closed loops from an uploaded SVG file, for the user to assign
// roles to (outer boundary / hole / ignore) in the picker UI. Uses the browser's own
// SVGGeometryElement.getPointAtLength — no path-parsing dependency needed, and it
// correctly handles beziers/arcs/etc. without us reimplementing curve flattening.
//
// DOM-dependent (SVGPathElement, getCTM, getPointAtLength) — not unit-tested under
// vitest's default Node environment; verified via manual browser testing instead
// (see plan notes). Keep this file's logic thin and push anything testable (the pure
// geometry: centroid, containment, scaling) into customShape.ts.

import type { Loop } from "../geometry/customShape";

export interface Candidate {
  id: string;
  loop: Loop;
  /** Bounding-box area, for the auto-suggest heuristic (largest = outer). */
  area: number;
}

export interface DeclaredSize {
  widthMm: number;
  heightMm: number;
}

const UNIT_TO_MM: Record<string, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  pt: 25.4 / 72,
  pc: 25.4 / 6,
};

function parseLengthMm(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = raw.trim().match(/^([\d.]+)\s*(mm|cm|in|pt|pc)$/i);
  if (!match) return null; // bare numbers / px / % aren't reliably physical — see below
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  return value * UNIT_TO_MM[unit];
}

/**
 * Reads the root <svg>'s declared width/height as real-world mm, if (and only if) it
 * declares an explicit physical unit (mm/cm/in/pt/pc) — a bare number or "px" doesn't
 * reliably mean anything physical (most design-tool exports default to screen-pixel
 * dimensions with no relation to intended real-world size), so those are deliberately
 * left alone rather than guessed at. Pure string parsing, not DOM-dependent, so this
 * one (unlike the rest of this file) is unit-tested.
 */
export function extractDeclaredSizeMm(svgText: string): DeclaredSize | null {
  const tagMatch = svgText.match(/<svg\b[^>]*>/);
  if (!tagMatch) return null;
  const tag = tagMatch[0];
  const widthMm = parseLengthMm(tag.match(/\bwidth="([^"]+)"/)?.[1]);
  const heightMm = parseLengthMm(tag.match(/\bheight="([^"]+)"/)?.[1]);
  if (widthMm === null || heightMm === null) return null;
  return { widthMm, heightMm };
}

const SHAPE_SELECTOR = "path, polygon, polyline, rect, circle, ellipse";
const MAX_POINTS_PER_LOOP = 200;
const MIN_ARC_LENGTH_STEP = 0.5; // in the element's own user units
// A real decorative outline is a handful of shapes at most. A Shaper toolpath file
// (like the ones this app itself exports) can have hundreds of concentric rings —
// treating each as a hole candidate blows up the pairwise overlap/containment checks
// downstream (O(n²) comparisons, each itself O(n) on ~200-point loops). Stop sampling
// once we're clearly past "simple outline" territory rather than grinding through the
// rest and freezing the tab; the caller surfaces this as a clear rejection, not silent
// truncation.
export const MAX_CANDIDATES = 40;

function matrixPoint(m: DOMMatrix, x: number, y: number): { x: number; y: number } {
  const p = new DOMPoint(x, y).matrixTransform(m);
  return { x: p.x, y: p.y };
}

function sampleGeometry(el: SVGGeometryElement): { x: number; y: number }[] {
  const total = el.getTotalLength();
  if (!Number.isFinite(total) || total < 1e-6) return [];
  const step = Math.max(MIN_ARC_LENGTH_STEP, total / MAX_POINTS_PER_LOOP);
  const count = Math.min(MAX_POINTS_PER_LOOP, Math.max(8, Math.ceil(total / step)));
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < count; i++) {
    const len = (total * i) / count;
    const p = el.getPointAtLength(len);
    points.push({ x: p.x, y: p.y });
  }
  return points;
}

function splitPathSubpaths(d: string): string[] {
  const trimmed = d.trim();
  if (!trimmed) return [];
  // Split right before each M/m that starts a new subpath (keep the command).
  const parts = trimmed.split(/(?=[Mm])/g).filter((s) => s.trim().length > 0);
  return parts;
}

function isClosedSubpath(d: string): boolean {
  return /[Zz]\s*$/.test(d.trim());
}

function dedupeClose(points: { x: number; y: number }[]): Loop {
  if (points.length < 2) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-6) {
    return points.slice(0, -1);
  }
  return points;
}

function loopArea(loop: Loop): number {
  let sum = 0;
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % loop.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum / 2);
}

/**
 * Parses an uploaded SVG's text content into candidate closed loops, each already
 * transformed into the root `<svg>`'s coordinate space (ancestor group transforms,
 * nested viewBoxes, etc. all resolved via the browser's own getCTM()).
 */
export function parseCandidateLoops(svgText: string): Candidate[] {
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

  const candidates: Candidate[] = [];
  let counter = 0;

  try {
    const elements = Array.from(imported.querySelectorAll(SHAPE_SELECTOR)) as SVGGeometryElement[];
    for (const el of elements) {
      if (candidates.length > MAX_CANDIDATES) break; // see MAX_CANDIDATES note above
      const ctm = el.getCTM();
      if (!ctm) continue;

      const tag = el.tagName.toLowerCase();
      if (tag === "path") {
        const d = el.getAttribute("d") ?? "";
        const subpaths = splitPathSubpaths(d);
        for (const sub of subpaths) {
          if (!isClosedSubpath(sub)) continue;
          const temp = document.createElementNS("http://www.w3.org/2000/svg", "path");
          temp.setAttribute("d", sub);
          const localPoints = sampleGeometry(temp);
          if (localPoints.length < 3) continue;
          const loop = dedupeClose(localPoints.map((p) => matrixPoint(ctm, p.x, p.y)));
          if (loop.length < 3) continue;
          candidates.push({ id: `candidate-${counter++}`, loop, area: loopArea(loop) });
        }
      } else if (tag === "polyline") {
        const localPoints = sampleGeometry(el);
        const loop = dedupeClose(localPoints.map((p) => matrixPoint(ctm, p.x, p.y)));
        // polyline is open by SVG definition — only treat as a candidate if its
        // endpoints are (near) coincident, i.e. the author effectively closed it.
        const first = localPoints[0];
        const last = localPoints[localPoints.length - 1];
        if (!first || !last || Math.hypot(first.x - last.x, first.y - last.y) > 1e-3) continue;
        if (loop.length < 3) continue;
        candidates.push({ id: `candidate-${counter++}`, loop, area: loopArea(loop) });
      } else {
        // polygon, rect, circle, ellipse are always closed.
        const localPoints = sampleGeometry(el);
        const loop = dedupeClose(localPoints.map((p) => matrixPoint(ctm, p.x, p.y)));
        if (loop.length < 3) continue;
        candidates.push({ id: `candidate-${counter++}`, loop, area: loopArea(loop) });
      }
    }
  } finally {
    document.body.removeChild(container);
  }

  return candidates;
}
