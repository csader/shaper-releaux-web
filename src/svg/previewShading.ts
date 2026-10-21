// Preview-only transform: the exported SVG stacks hundreds of same-colored,
// semi-transparent rings, which is the correct encoding for Shaper Origin (color
// encodes cut type, not depth) but reads as a flat silhouette on screen — opacity
// compounds fast across that many overlapping layers, saturating to solid within the
// first few rings. This reassigns each ring a grey shade so individual ring bands
// read clearly, like a topographic contour map. Doesn't touch the real exported file
// content anywhere else.
//
// Shaded by each ring's actual cutDepth value (normalized across this file's own
// min/max), not by its position in the ring list. A fixed palette cycled by array
// index looks fine when rings are evenly spaced, but a custom profile curve (see
// geometry/customProfile.ts) can produce wildly uneven ring density — lots of rings
// packed into a steep section, few in a flat one — and cycling a small palette by
// index across that unevenness reads as confusing banding rather than a clean
// gradient, even though the underlying geometry is correct. Keying off the real
// depth value instead means the shade step between two rings is proportional to the
// actual depth difference between them, so it stays a smooth gradient regardless of
// how densely or sparsely the rings happen to be spaced.

const SHADE_SHALLOW = 235; // near the surface — light
const SHADE_DEEP = 85; // most material removed — dark

// Larger cutDepthMm means a deeper cut in this app's encoding (confirmed against
// both interior and exterior profiles, with or without a Z-touch reference block —
// see profile.ts/generate.ts), so depth increasing maps to shade decreasing. Exported
// (unlike the rest of this DOM-dependent file) because it's pure/testable.
export function shadeForDepth(depth: number, minDepth: number, maxDepth: number): number {
  const range = maxDepth - minDepth || 1;
  const normalized = (depth - minDepth) / range; // 0 = shallowest, 1 = deepest
  return Math.round(SHADE_SHALLOW - normalized * (SHADE_SHALLOW - SHADE_DEEP));
}

// Ring boundary outline — a distinct hue (not just another shade of grey) so it stays
// visible against the fill regardless of how light or dark that ring's depth-based
// shade happens to be. Width is a fraction of the bowl's own size (read from the
// SVG's viewBox below) rather than a fixed mm value, so it reads consistently thin
// whether the bowl is 50mm or 300mm across.
const OUTLINE_COLOR = "#4a6cf7";
const OUTLINE_WIDTH_FRACTION = 0.0015;

export function shadePreviewSvg(svgContent: string): string {
  const doc = new DOMParser().parseFromString(svgContent, "image/svg+xml");
  const g = doc.querySelector("g");
  if (!g) return svgContent;

  // The anchor marker (if present) is a registration point, not a cut ring — leave
  // its own red styling alone and keep it on top rather than folding it into the
  // shading cycle below.
  const anchor = g.querySelector("#anchor-marker");
  const paths = Array.from(g.querySelectorAll("path")).filter((p) => p !== anchor);
  const n = paths.length;
  if (n === 0) return svgContent;

  const depths = paths.map((p) => parseFloat(p.getAttribute("shaper:cutDepth") ?? "0"));
  const minDepth = Math.min(...depths);
  const maxDepth = Math.max(...depths);

  const viewBox = doc.documentElement.getAttribute("viewBox")?.split(/\s+/).map(Number);
  const boundingSize = viewBox && viewBox.length === 4 ? Math.max(viewBox[2], viewBox[3]) : 100;
  const outlineWidth = boundingSize * OUTLINE_WIDTH_FRACTION;

  // Original document order is smallest-ring-first (generation order). SVG paints in
  // document order, so re-append largest-first (bottom) -> smallest-last (top),
  // otherwise the final (largest) ring would paint over every smaller one. Each ring
  // is a full filled shape at its own diameter (not an annulus), so painting them in
  // this order and keeping each one's own outline means that outline only ever shows
  // where a smaller ring hasn't painted over it — exactly at that ring's boundary.
  for (let i = n - 1; i >= 0; i--) g.appendChild(paths[i]);

  paths.forEach((p, i) => {
    const shade = shadeForDepth(depths[i], minDepth, maxDepth);
    p.setAttribute(
      "style",
      `fill:rgb(${shade},${shade},${shade}) !important;stroke:${OUTLINE_COLOR} !important;` +
        `stroke-width:${outlineWidth} !important;stroke-opacity:0.6 !important;opacity:1 !important`,
    );
  });

  if (anchor) g.appendChild(anchor);

  return new XMLSerializer().serializeToString(doc);
}
