// Chord / flute groove generator (Andrew Weighill-Richards' "Chord calculations"
// reference — see geometry/chord.ts). Models a straight decorative groove (e.g. a
// fluted door stave) as a stack of parallel, full-length "online" passes stepped
// across the groove's width, each cut at the depth its circular-arc cross-section
// calls for at that offset — the same constant-depth-per-path approach the bowl tool
// uses for its rings, just stepped linearly across a width instead of radially.

import { buildShaperSvg, type CutPath } from "../../svg/shaperSvg";
import { splitIntoChunks } from "../../svg/fileSplit";
import type { GeneratedFile } from "../../types";
import { chordDepthAt, chordRadius, type ChordProfile } from "../../geometry/chord";

const round = (n: number) => Math.round(n * 1e4) / 1e4;

export interface ChordParams {
  /** Concave (dish/fluting — cut into the surface) or convex (arch/reeding — a raised
   * rounded bead) — see geometry/chord.ts for the depth-formula relationship. */
  profile: ChordProfile;
  /** Surface width of each groove (the "chord" — 2W in the reference formula). */
  grooveWidthMm: number;
  /** Depth at the groove's centerline (Z in the reference formula). */
  grooveDepthMm: number;
  /** Length each flute runs (direction of travel). */
  lengthMm: number;
  /** Spacing between adjacent passes across the groove's width. */
  stepMm: number;
  /** Number of parallel flutes. */
  fluteCount: number;
  /** Center-to-center spacing between flutes (only matters when fluteCount > 1). */
  flutePitchMm: number;
  bitSize: number;
}

function verticalLineCutPath(id: string, x: number, y1: number, y2: number, depth: number, bitSize: number): CutPath {
  return {
    id,
    d: `M ${round(x)},${round(y1)} L ${round(x)},${round(y2)}`,
    cutType: "online",
    cutDepthMm: round(depth),
    toolDiaMm: bitSize,
  };
}

function flutePasses(fluteIndex: number, centerX: number, p: ChordParams): CutPath[] {
  const halfWidth = p.grooveWidthMm / 2;
  const steps = Math.max(1, Math.round(p.grooveWidthMm / p.stepMm));
  const paths: CutPath[] = [];
  for (let i = 0; i <= steps; i++) {
    const offset = -halfWidth + (p.grooveWidthMm * i) / steps;
    const depth = chordDepthAt(offset, halfWidth, p.grooveDepthMm, p.profile);
    // Concave: skipped at the groove's edges (no material removed there). Convex:
    // skipped at the centerline (the peak, left uncut) — same "no-op pass" guard,
    // just at the opposite end of the sweep.
    if (depth <= 0) continue;
    paths.push(verticalLineCutPath(`f${fluteIndex}-${i}`, centerX + offset, 0, p.lengthMm, depth, p.bitSize));
  }
  return paths;
}

export function generateChord(params: ChordParams): GeneratedFile[] {
  const halfWidth = params.grooveWidthMm / 2;
  const totalWidth = params.flutePitchMm * (params.fluteCount - 1) + params.grooveWidthMm;

  const paths: CutPath[] = [];
  for (let f = 0; f < params.fluteCount; f++) {
    const centerX = halfWidth + f * params.flutePitchMm;
    paths.push(...flutePasses(f, centerX, params));
  }

  const comments: Record<string, string | number> = {
    Profile: params.profile,
    "Groove Width": params.grooveWidthMm,
    "Groove Depth": params.grooveDepthMm,
    Length: params.lengthMm,
    Step: params.stepMm,
    "Flute Count": params.fluteCount,
    "Flute Pitch": params.flutePitchMm,
    "Bit Size": params.bitSize,
    "Computed Radius": round(chordRadius(halfWidth, params.grooveDepthMm)),
  };

  const chunks = splitIntoChunks(paths);
  return chunks.map((chunk, i) => {
    const name = `Chord${chunks.length > 1 ? `-part${i + 1}` : ""}.svg`;
    return {
      name,
      content: buildShaperSvg({
        boundingWidthMm: totalWidth + 2 * params.bitSize,
        boundingHeightMm: params.lengthMm + 2 * params.bitSize,
        originX: -params.bitSize,
        originY: -params.bitSize,
        paths: chunk,
        comments,
        docName: name,
      }),
    };
  });
}
