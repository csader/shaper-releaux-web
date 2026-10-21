// Shaper Origin "custom anchor" markers — a registration point the physical tool can
// use to locate itself on the material without tracking tape. Per Shaper's own spec
// (support.shapertools.com, "Custom Anchors"): represented purely by a closed,
// red-filled, stroke-free right triangle — the right-angle vertex is the anchor
// point, the shorter leg marks its X axis, the longer leg its Y axis. No shaper:
// namespace attribute is involved; Origin's importer recognizes the shape itself.

export type AnchorPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "custom";

export interface AnchorConfig {
  enabled: boolean;
  position: AnchorPosition;
  /** mm, absolute in the same design space as the bounding box (only used when position === "custom"). */
  customX?: number;
  customY?: number;
}

export interface BoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Per the spec, the shorter leg is the X axis and the longer leg is the Y axis. */
export const ANCHOR_LEG_X_MM = 5;
export const ANCHOR_LEG_Y_MM = 10;

/**
 * `trueCenter`, if given, is used for position="center" instead of the bounding
 * box's own midpoint — they can differ (e.g. odd-n Reuleaux shapes aren't centered
 * in their own declared bounding box; see shapeCenterFor in tools/bowl/generate.ts).
 * Falls back to the box midpoint when omitted, so other callers (and "custom" with
 * no coordinates set yet) still get a sensible default.
 */
export function resolveAnchorPoint(
  anchor: AnchorConfig,
  box: BoundingBox,
  trueCenter?: { x: number; y: number },
): { x: number; y: number } | null {
  if (!anchor.enabled) return null;
  const left = box.originX;
  const right = box.originX + box.width;
  const top = box.originY;
  const bottom = box.originY + box.height;
  const midX = trueCenter?.x ?? box.originX + box.width / 2;
  const midY = trueCenter?.y ?? box.originY + box.height / 2;
  switch (anchor.position) {
    case "top-left":
      return { x: left, y: top };
    case "top-center":
      return { x: midX, y: top };
    case "top-right":
      return { x: right, y: top };
    case "middle-left":
      return { x: left, y: midY };
    case "center":
      return { x: midX, y: midY };
    case "middle-right":
      return { x: right, y: midY };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom-center":
      return { x: midX, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
    case "custom":
      return { x: anchor.customX ?? midX, y: anchor.customY ?? midY };
  }
}

/** Direction is fixed, not position-dependent: short (X) leg to the right, long (Y)
 * leg upward (negative in SVG's own y-down coordinate space) — confirmed against
 * Shaper Studio's own rendering, which always places the right-angle vertex at what
 * reads visually as the marker's bottom-left corner. An earlier version of this
 * function pointed each leg "inward" toward the bounding box depending on which grid
 * cell was picked (purely cosmetic, since per Shaper's own custom-anchor spec, Origin
 * only reads the right-angle vertex and relative leg lengths — it realigns axes to
 * its own grid/screen regardless of which way the legs point in the file) — that
 * made most positions render upside-down relative to Studio's own convention, which
 * is what this fixed direction fixes. */
export function anchorTrianglePathData(x: number, y: number): string {
  const x2 = x + ANCHOR_LEG_X_MM;
  const y2 = y - ANCHOR_LEG_Y_MM;
  return `M ${round(x)} ${round(y)} L ${round(x2)} ${round(y)} L ${round(x)} ${round(y2)} Z`;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}
