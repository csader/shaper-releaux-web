// Wave Effect Surface Treatment (Andrew Weighill-Richards, CC BY-NC-SA 4.0 — see
// LICENSE note in the UI). Three variants reverse-engineered from the author's
// spreadsheets: furrows and a sine contour share one depth formula
// `depth = A + A·sin(i/N · 360°)`; diminishing rings use
// `depth = A(r)·(1 − cos(r/λ · 360°))` with `A(r)` shrinking linearly to 0 at the
// outer radius. Each is an "online" cut — the tool follows the drawn line directly.

import { buildShaperSvg, type CutPath } from "../../svg/shaperSvg";
import { splitIntoChunks } from "../../svg/fileSplit";
import type { GeneratedFile } from "../../types";

const toRad = (deg: number) => (deg * Math.PI) / 180;
const round = (n: number) => Math.round(n * 1e4) / 1e4;

export type RippleVariant = "furrows" | "sineContour" | "diminishingRings";

export interface RippleParams {
  variant: RippleVariant;
  widthMm: number;
  heightMm: number;
  maxDepthMm: number;
  /** Furrows/sineContour: distance between adjacent lines. DiminishingRings: distance between rings. */
  spacingMm: number;
  /** Wavelength along the direction of travel (furrows: across lines; rings: along radius). */
  wavelengthMm: number;
  bitSize: number;
}

function lineCutPath(id: string, x1: number, y: number, x2: number, depth: number, bitSize: number): CutPath {
  return {
    id,
    d: `M ${x1},${y} L ${x2},${y}`,
    cutType: "online",
    cutDepthMm: round(depth),
    toolDiaMm: bitSize,
  };
}

function furrows(p: RippleParams): CutPath[] {
  const amplitude = p.maxDepthMm / 2;
  const linesPerCycle = p.wavelengthMm / p.spacingMm;
  const count = Math.floor(p.heightMm / p.spacingMm);
  const paths: CutPath[] = [];
  for (let i = 0; i <= count; i++) {
    const y = i * p.spacingMm;
    const depth = amplitude + amplitude * Math.sin(toRad((i / linesPerCycle) * 360));
    paths.push(lineCutPath(i.toString(), 0, y, p.widthMm, depth, p.bitSize));
  }
  return paths;
}

function sineContour(p: RippleParams): CutPath[] {
  const amplitude = p.maxDepthMm / 2;
  const linesPerCycle = p.wavelengthMm / p.spacingMm;
  const rowCount = Math.floor(p.heightMm / p.spacingMm);
  const waveAmplitudeMm = Math.min(p.spacingMm * 0.4, 5);
  const samples = 40;
  const paths: CutPath[] = [];
  for (let i = 0; i <= rowCount; i++) {
    const baseY = i * p.spacingMm;
    const depth = amplitude + amplitude * Math.sin(toRad((i / linesPerCycle) * 360));
    const points: string[] = [];
    for (let s = 0; s <= samples; s++) {
      const x = (p.widthMm * s) / samples;
      const y = baseY + waveAmplitudeMm * Math.sin(toRad((x / p.wavelengthMm) * 360));
      points.push(`${round(x)},${round(y)}`);
    }
    paths.push({
      id: i.toString(),
      d: `M ${points[0]} L ${points.slice(1).join(" L ")}`,
      cutType: "online",
      cutDepthMm: round(depth),
      toolDiaMm: p.bitSize,
    });
  }
  return paths;
}

function diminishingRings(p: RippleParams): CutPath[] {
  const maxRadius = Math.min(p.widthMm, p.heightMm) / 2;
  const cx = p.widthMm / 2;
  const cy = p.heightMm / 2;
  const paths: CutPath[] = [];
  for (let r = p.spacingMm; r < maxRadius; r += p.spacingMm) {
    const amplitudeAtR = p.maxDepthMm * (1 - r / maxRadius);
    const depth = amplitudeAtR * (1 - Math.cos(toRad((r / p.wavelengthMm) * 360)));
    // Full circle as two semicircle arcs.
    const d = `M ${round(cx - r)},${round(cy)} A ${round(r)},${round(r)} 0 0 0 ${round(cx + r)},${round(cy)} A ${round(r)},${round(r)} 0 0 0 ${round(cx - r)},${round(cy)} Z`;
    paths.push({
      id: round(r).toString(),
      d,
      cutType: "online",
      cutDepthMm: round(depth),
      toolDiaMm: p.bitSize,
    });
  }
  return paths;
}

export function generateRipple(params: RippleParams): GeneratedFile[] {
  const paths =
    params.variant === "furrows"
      ? furrows(params)
      : params.variant === "sineContour"
        ? sineContour(params)
        : diminishingRings(params);

  const comments: Record<string, string | number> = {
    Variant: params.variant,
    Width: params.widthMm,
    Height: params.heightMm,
    "Max Depth": params.maxDepthMm,
    Spacing: params.spacingMm,
    Wavelength: params.wavelengthMm,
    "Bit Size": params.bitSize,
  };

  const chunks = splitIntoChunks(paths);
  return chunks.map((chunk, i) => {
    const name = `Ripple-${params.variant}${chunks.length > 1 ? `-part${i + 1}` : ""}.svg`;
    return {
      name,
      content: buildShaperSvg({
        boundingWidthMm: params.widthMm + 2 * params.bitSize,
        boundingHeightMm: params.heightMm + 2 * params.bitSize,
        originX: -params.bitSize,
        originY: -params.bitSize,
        paths: chunk,
        comments,
        docName: name,
      }),
    };
  });
}
