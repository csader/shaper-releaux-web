// Dispatches by side-count to the right outline builder. n=1 is the raw profile
// directly — no polygon construction layer, and no sample exists for it, but it's
// the lowest-risk shape precisely because it's "nothing extra on top of the formula
// already confirmed in profile.ts".

import type { ArcSegment, PolygonOutline } from "./reuleauxPolygon";
import { reuleauxPolygonOutline } from "./reuleauxPolygon";
import { heartOutline } from "./heart";

export type Sides = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Ellipse outline as two half-ellipse arcs. Dx/Dy allow independent X/Y (circle when equal). */
function ellipseOutline(Dx: number, Dy: number, cx: number, cy: number, sweep: 0 | 1 = 0): PolygonOutline {
  const left = { x: cx - Dx / 2, y: cy };
  const right = { x: cx + Dx / 2, y: cy };
  const arcs: ArcSegment[] = [
    { to: right, rx: Dx / 2, ry: Dy / 2, sweep },
    { to: left, rx: Dx / 2, ry: Dy / 2, sweep },
  ];
  return { start: left, arcs };
}

export interface ShapeOutlineOptions {
  sides: Sides;
  /** Overall width for the common case; for n=1/4 with independent axes use dx/dy. */
  diameter: number;
  dx?: number;
  dy?: number;
  cx: number;
  cy: number;
  sweep?: 0 | 1;
}

export function shapeOutline(opts: ShapeOutlineOptions): PolygonOutline {
  const { sides, diameter, cx, cy, sweep = 0 } = opts;
  switch (sides) {
    case 1:
      return ellipseOutline(opts.dx ?? diameter, opts.dy ?? diameter, cx, cy, sweep);
    case 2:
      return heartOutline(diameter, cx, cy, sweep);
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
      return reuleauxPolygonOutline(sides, diameter, cx, cy, sweep);
  }
}
