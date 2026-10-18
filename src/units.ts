// All geometry/state is stored in mm internally, and exported files are always mm —
// matching the original Reuleaux app's metric-only convention, not a Shaper Origin
// requirement (its shaper:cutDepth encoding explicitly supports both mm and in per
// Shaper's own docs). This file is purely a display/input convenience layer.

export type Unit = "mm" | "in";

const MM_PER_INCH = 25.4;

export function mmToDisplay(mm: number, unit: Unit): number {
  const v = unit === "in" ? mm / MM_PER_INCH : mm;
  return Math.round(v * 1e4) / 1e4;
}

export function displayToMm(value: number, unit: Unit): number {
  return unit === "in" ? value * MM_PER_INCH : value;
}

export function unitLabel(unit: Unit): string {
  return unit === "in" ? "in" : "mm";
}
