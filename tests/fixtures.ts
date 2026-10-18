import { readFileSync } from "fs";
import { join } from "path";

// Sample files live one level above the repo folder: "<Reuleaux App>/<sample dir>/*.svg"
const SAMPLES_ROOT = join(import.meta.dirname, "..", "..");

export function readSample(dir: string, file: string): string {
  return readFileSync(join(SAMPLES_ROOT, dir, file), "utf-8");
}

export interface SampleRing {
  id: string;
  theta: number;
  radius: number;
  cutDepth: number;
}

/** Parses `id="<theta>" ... A <radius>, ... shaper:cutDepth="<depth>mm"` triples —
 * matches the structure of ReuleauxExterior.svg / ReuleauxInterior*.svg, where each
 * ring is a single arc-chain so the first radius found is the (shared) ring radius. */
export function parseRings(svg: string): SampleRing[] {
  const re = /id="([0-9.]+)"[^>]*?\n\s*d="[^"]*?A ([0-9.]+),[^"]*?"\s*\n\s*shaper:cutDepth="(-?[0-9.]+)mm"/gs;
  const rings: SampleRing[] = [];
  for (const m of svg.matchAll(re)) {
    rings.push({ id: m[1], theta: parseFloat(m[1]), radius: parseFloat(m[2]), cutDepth: parseFloat(m[3]) });
  }
  return rings;
}

export interface ParsedArc {
  rx: number;
  ry: number;
  sweep: 0 | 1;
  x: number;
  y: number;
}

export interface ParsedSubpath {
  start: { x: number; y: number };
  arcs: ParsedArc[];
}

/**
 * Proper SVG path tokenizer for the "M x,y A rx,ry rot large sweep x,y ..." subset
 * used throughout these samples — critically, handles *implicit command repetition*
 * (consecutive arcs after the first omit the "A" letter), which a naive "match every
 * 'A x,y'" regex misses since most arcs in a chain never have a literal "A" before them.
 */
export function parseSubpaths(d: string): ParsedSubpath[] {
  const tokens = d.match(/[MmAaZz]|-?[0-9.]+(?:e-?\d+)?/g) ?? [];
  const subpaths: ParsedSubpath[] = [];
  let i = 0;
  let current: ParsedSubpath | null = null;
  let mode: "M" | "A" | null = null;

  const num = () => parseFloat(tokens[i++]);

  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok === "M" || tok === "m") {
      i++;
      const x = num();
      const y = num();
      current = { start: { x, y }, arcs: [] };
      subpaths.push(current);
      mode = "M";
      continue;
    }
    if (tok === "A" || tok === "a") {
      i++;
      mode = "A";
      // fall through to read one arc's 7 numbers below
    } else if (tok === "Z" || tok === "z") {
      i++;
      mode = null;
      continue;
    }
    if (mode === "A" && current) {
      const rx = num();
      const ry = num();
      num(); // x-axis-rotation
      num(); // large-arc-flag
      const sweep = num() as 0 | 1;
      const x = num();
      const y = num();
      current.arcs.push({ rx, ry, sweep, x, y });
      continue;
    }
    i++; // unrecognized token, skip defensively
  }
  return subpaths;
}

/**
 * Our generator and the sample may start at a different point / wind in a different
 * direction (that's an implementation-detail labeling choice, not a geometry bug).
 * Finds the rotation (and optionally reversed direction) of `actual` that best
 * matches `expected`, so tests can assert shape congruence rather than index-for-index
 * equality. Assumes both point lists represent the same *closed* polygon (first point
 * duplicated at the end) and are the same length.
 */
export function bestCyclicAlignment(
  actual: { x: number; y: number }[],
  expected: { x: number; y: number }[],
): { x: number; y: number }[] {
  const n = actual.length - 1; // distinct points (last duplicates first)
  const base = actual.slice(0, n);
  let best: { x: number; y: number }[] | null = null;
  let bestErr = Infinity;
  for (const seq of [base, base.slice().reverse()]) {
    for (let shift = 0; shift < n; shift++) {
      const rotated = [...seq.slice(shift), ...seq.slice(0, shift)];
      const candidate = [...rotated, rotated[0]];
      let err = 0;
      for (let i = 0; i < candidate.length; i++) {
        err += Math.hypot(candidate[i].x - expected[i].x, candidate[i].y - expected[i].y);
      }
      if (err < bestErr) {
        bestErr = err;
        best = candidate;
      }
    }
  }
  return best!;
}

export function circumcenter(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): { x: number; y: number } {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  const ux =
    ((a.x ** 2 + a.y ** 2) * (b.y - c.y) +
      (b.x ** 2 + b.y ** 2) * (c.y - a.y) +
      (c.x ** 2 + c.y ** 2) * (a.y - b.y)) /
    d;
  const uy =
    ((a.x ** 2 + a.y ** 2) * (c.x - b.x) +
      (b.x ** 2 + b.y ** 2) * (a.x - c.x) +
      (c.x ** 2 + c.y ** 2) * (b.x - a.x)) /
    d;
  return { x: ux, y: uy };
}
