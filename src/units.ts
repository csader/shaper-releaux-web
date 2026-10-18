// All geometry/state is stored in mm internally (matching the original app and
// Shaper Origin's metric-only expectation — exported files are always mm). This is
// purely a display/input convenience layer.

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
