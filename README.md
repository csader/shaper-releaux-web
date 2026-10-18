# Reuleaux Web

A browser-based reimplementation of [Andrew Weighill-Richards'](https://hub.shapertools.com/creators/63b611f2fbe48653c207db8d) **Reuleaux** — a Windows-only tool that generates [Shaper Origin](https://www.shapertools.com/)-ready SVG toolpaths for carving bowls, plus a second tool for decorative wave/ripple surface textures. Runs entirely client-side: no backend, no install beyond Node for local dev, no data leaves your browser.

There's no source available for the original app, so this is a from-scratch reimplementation. The core geometry was reverse-engineered from the original author's own spreadsheets and documentation, then validated against real sample output files.

## Features

### Bowl Generator — reproduces the original Windows app

The original Reuleaux.exe generates four SVG files (`Exterior`, `ExteriorRoughing`, `Interior`, `InteriorRoughing`) encoded with `shaper:cutDepth` / `shaper:toolDia` per [Shaper's manual cut-depth spec](https://support.shapertools.com/hc/en-us/articles/12946815194011-manual-svg-cut-depth-encoding), for 7 shapes: circle/ellipse, heart, Reuleaux triangle, square/rectangle, Reuleaux pentagon, hexagon, Reuleaux heptagon (each with independent X/Y where applicable, e.g. ellipses and rectangles) — plus a foot relief pocket in the roughing file when there's room for it, and circumferential finishing-pass stepping. This web version reproduces all of that, validated where real sample output existed to check against (see Testing below) — it's not a reinterpretation, it's meant to produce the same geometry.

### Bowl Generator — new in this version

Capabilities that don't exist in the original Windows app:

- **Custom SVG import**: upload your own closed outline — including shapes with holes (e.g. a ring, a letterform) — and it drives the same profile math, roughing, and relief-pocket pipeline as the built-in shapes. Includes a candidate picker, validation (self-intersection, hole containment), and a multi-scale preview so problems are visible before generating
- **Radial stepping as a selectable alternative** to circumferential, per surface (the original app only ever produces circumferential output)
- **Foot relief pocket on/off toggle** (the original always includes it when there's room)
- **mm/in input toggle** (exported files are still always mm, matching the original's metric-only convention — not a Shaper Origin limitation, its cutDepth encoding supports both units)
- **Floor thickness / lip width safety readouts** that warn when a combination of depths would leave the wall or floor thinner than the current bit size (or cut through entirely)
- **Common bit size presets** (1/8", 1/4", 1/2", 3/6/8/16mm) alongside free-form entry
- **Optional Shaper Origin custom anchor marker** — a registration-point triangle (per [Shaper's custom anchor spec](https://support.shapertools.com/hc/en-us/articles/4402965445019-custom-anchors)) placed via a 9-point grid or a draggable custom position, baked identically into every generated file so the same physical mark registers all four passes
- **Bounding-box guide rectangle toggle** — off by default; the original app always includes this (invisible, zero-width-stroke) rect, this version makes it optional
- Live in-browser SVG preview and zip download — the original is a text-prompt CLI tool with no preview, and runs only on Windows

### Wave / Ripple Generator — new in this version

Not part of Reuleaux.exe at all. The original author documented a related but separate technique, [Wave Effect Surface Treatment](https://hub.shapertools.com/) (CC BY-NC-SA 4.0 — noncommercial, attribution, share-alike) — a manual Inkscape + spreadsheet workflow, not a tool. This turns that technique into a generator for parallel furrows, a tileable sine contour, or concentric diminishing rings.

## Getting started

```bash
npm install
npm run dev
```

Opens a dev server (prints a `localhost` URL) with hot-reload. Requires Node.js (any recent LTS).

For a production-style run instead:

```bash
npm run build
npm run preview
```

It's a static SPA, so the `dist/` output from `npm run build` can also be dropped onto any static host or served by any local file server.

## Testing

```bash
npm run test
```

The geometry is unit-tested against real ground-truth data where it exists: a known-good bowl output sample (pentagon, including a real foot-relief-pocket path), plus self-consistency checks for the shapes that have no sample to verify against. See `tests/` — each file explains what it's checking and why.

## Project structure

```
src/
  geometry/     pure math: profile curves, per-shape outline construction, custom-shape handling
  svg/          SVG document assembly (Shaper namespace, path building, file splitting)
  tools/        bowl/ and ripple/ — orchestration + UI for each tool
  import/       browser-native SVG parsing for custom shape upload
tests/          geometry correctness, much of it validated against real sample output
```

## License / attribution

The bowl-generation technique and geometry are based on Andrew Weighill-Richards' original Reuleaux app and published documentation. The Wave Effect Surface Treatment technique specifically is CC BY-NC-SA 4.0 licensed by its author — noncommercial use, attribution, share-alike.
