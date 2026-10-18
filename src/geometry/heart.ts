// Heart outline (n=2). Reverse-engineered from a real "Valentine's bowl" sample:
// two overlapping lobe circles whose inner intersection forms the top notch, joined
// by one big elliptical arc on each side down to a bottom cusp. Proportions (as a
// fraction of the overall width D) were measured directly off two different depth
// rings in the sample and agreed to 4 significant figures:
//   lobe radius      = 0.3 · D
//   lobe offset (±x) = 0.2 · D   (so lobe separation = 0.4 · D)
//   big-arc rx       = D
//   big-arc ry       = 0.8083 · D   (empirical — no documented closed form, see plan)
// The shape is anchored at a fixed centre (cx, cy); width and height both equal D.

import type { ArcSegment, PolygonOutline } from "./reuleauxPolygon";

const LOBE_R_RATIO = 0.3;
const LOBE_OFFSET_RATIO = 0.2;
const BIG_ARC_RY_RATIO = 0.8083;

export function heartOutline(D: number, cx: number, cy: number, sweep: 0 | 1 = 0): PolygonOutline {
  const top = cy - D / 2;
  const bottom = cy + D / 2;
  const lobeR = D * LOBE_R_RATIO;
  const lobeOffset = D * LOBE_OFFSET_RATIO;
  const lobeCenterY = top + lobeR;
  const h = Math.sqrt(Math.max(lobeR * lobeR - lobeOffset * lobeOffset, 0));
  const notchY = lobeCenterY - h;
  const bigRy = D * BIG_ARC_RY_RATIO;

  const leftTop = { x: cx - lobeOffset, y: top };
  const leftOuter = { x: cx - lobeOffset - lobeR, y: lobeCenterY };
  const bottomCusp = { x: cx, y: bottom };
  const rightOuter = { x: cx + lobeOffset + lobeR, y: lobeCenterY };
  const rightTop = { x: cx + lobeOffset, y: top };
  const notch = { x: cx, y: notchY };

  const arcs: ArcSegment[] = [
    { to: leftOuter, radius: lobeR, sweep },
    { to: bottomCusp, rx: D, ry: bigRy, sweep },
    { to: rightOuter, rx: D, ry: bigRy, sweep },
    { to: rightTop, radius: lobeR, sweep },
    { to: notch, radius: lobeR, sweep },
    { to: leftTop, radius: lobeR, sweep },
  ];

  return { start: leftTop, arcs };
}
