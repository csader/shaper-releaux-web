# Reuleaux Web

A browser-based reimplementation of [Andrew Weighill-Richards'](https://hub.shapertools.com/creators/63b611f2fbe48653c207db8d) **Reuleaux** — a Windows-only tool that generates [Shaper Origin](https://www.shapertools.com/)-ready SVG toolpaths for carving bowls — plus a second tool for decorative wave/ripple surface textures. Runs entirely client-side: no backend, no install beyond Node for local dev, no data leaves your browser.

There's no source available for the original app, so this is a from-scratch reimplementation. The core geometry was reverse-engineered from the original author's own spreadsheets and documentation, then validated against real sample output files where they were available — not just "looks about right."

## Features

### Bowl Generator

Generates the same four SVG files (`Exterior`, `ExteriorRoughing`, `Interior`, `InteriorRoughing`) as the original app, encoded with `shaper:cutDepth` / `shaper:toolDia` per [Shaper's manual cut-depth spec](https://support.shapertools.com/hc/en-us/articles/12946815194011-manual-svg-cut-depth-encoding).

- **7 built-in shapes**: circle/ellipse, heart, Reuleaux triangle, square/rectangle, Reuleaux pentagon, hexagon, Reuleaux heptagon
- **Custom SVG import**: upload your own closed outline — including shapes with holes (e.g. a ring, a letterform) — and it drives the same profile math, roughing, and relief-pocket pipeline as the built-in shapes. Includes a candidate picker, validation (self-intersection, hole containment), and a multi-scale preview so problems are visible before generating
- Independent X/Y for ellipses and rectangles
- Radial or circumferential finishing-pass stepping (selectable per surface)
- Foot relief pocket, toggleable
- mm/in input toggle (exported files are always mm, per Shaper Origin's requirement)
- Live SVG preview, per-file or zip download

### Wave / Ripple Generator

A second, simpler tool based on the same author's [Wave Effect Surface Treatment](https://hub.shapertools.com/) technique (CC BY-NC-SA 4.0 — noncommercial, attribution, share-alike): parallel furrows, a tileable sine contour, or concentric diminishing rings.

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

## Known limitations

- **Hexagon bounding box**: a small, pre-existing geometric quirk — two of its six corners coincidentally land exactly on an axis, overflowing the declared bounding box slightly more than the sample-verified square does. Flagged in `tests/shapeBounds.test.ts` rather than guessed at, since only the square was ever sample-verified for that construction.
- **Rectangle (unequal X/Y, n=4)**: derived from the readme's description, not verified against a real sample (none was available). Self-consistency checked (collapses to the validated square as X→Y).
- **Heart's exact proportions**: reverse-engineered from a real sample, but one ratio (the lower arc's `ry`) is an empirical constant rather than a derived closed form.
- Custom SVG import supports one outer boundary plus flat (non-nested) holes — a hole inside a hole isn't supported.

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
