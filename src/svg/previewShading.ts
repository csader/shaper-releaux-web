// Preview-only transform: the exported SVG stacks hundreds of same-colored,
// semi-transparent rings, which is the correct encoding for Shaper Origin (color
// encodes cut type, not depth) but reads as a flat silhouette on screen — opacity
// compounds fast across that many overlapping layers, saturating to solid within the
// first few rings. This reassigns each ring a grey shade cycling through a small
// palette (not one continuous gradient — with hundreds of rings a linear gradient's
// per-ring step is imperceptible and just looks like a blur) so individual ring
// bands read clearly, like a topographic contour map. Doesn't touch the real
// exported file content anywhere else.

const PALETTE = [235, 205, 175, 145, 115, 85];

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

  // Original document order is smallest-ring-first (generation order). SVG paints in
  // document order, so re-append largest-first (bottom) -> smallest-last (top),
  // otherwise the final (largest) ring would paint over every smaller one.
  for (let i = n - 1; i >= 0; i--) g.appendChild(paths[i]);

  paths.forEach((p, i) => {
    const shade = PALETTE[i % PALETTE.length];
    p.setAttribute(
      "style",
      `fill:rgb(${shade},${shade},${shade}) !important;stroke:none !important;opacity:1 !important`,
    );
  });

  if (anchor) g.appendChild(anchor);

  return new XMLSerializer().serializeToString(doc);
}
