import type { PolygonOutline } from "../geometry/reuleauxPolygon";

const fmt = (n: number) => (Math.round(n * 1e5) / 1e5).toString();

/** Serializes a PolygonOutline to an SVG path `d` string: M start, then one A per arc, Z. */
export function outlineToPathData(outline: PolygonOutline): string {
  const parts: string[] = [`M ${fmt(outline.start.x)},${fmt(outline.start.y)}`];
  for (const arc of outline.arcs) {
    const rx = arc.rx ?? arc.radius ?? 0;
    const ry = arc.ry ?? arc.radius ?? 0;
    parts.push(`A ${fmt(rx)},${fmt(ry)} 0 0 ${arc.sweep} ${fmt(arc.to.x)},${fmt(arc.to.y)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}
