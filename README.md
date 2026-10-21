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
- **Hybrid stepping model** — circumferential, floored at the fixed radial step size. On a wide, shallow profile, circumferential alone can pack a dense cluster of near-identical rings near the center (the profile is nearly flat there — see the comment on `stepAngles` in `src/geometry/profile.ts`); hybrid avoids that with no added parameters, converging to pure circumferential once its own adaptive step naturally grows past the radial floor. Circumferential (the original app's only model) is still the default; switch to Hybrid for a wide/shallow shape prone to that clustering
- **Horizontal stepping model** — the original app's own fourth, undocumented-in-code model: constant-radius steps rather than constant arc length (circumferential) or constant angle (radial). The author recommends it specifically for wide, shallow shapes like stool tops
- **Scallop (cusp) height readout** — the ridge left between adjacent ball-nose finishing passes depends on the bit's radius, not just MM cut, so the same MM cut leaves a visibly rougher finish on a smaller-diameter bit. Shown live next to the MM cut field, with a warning when it's large enough to be visible, and a distinct error when MM cut meets or exceeds the bit diameter (that leaves gaps, not just roughness)
- **Foot relief pocket on/off toggle** (the original always includes it when there's room)
- **mm/in input toggle** (exported files are still always mm, matching the original's metric-only convention — not a Shaper Origin limitation, its cutDepth encoding supports both units)
- **Dimension fields accept expressions**, not just plain numbers — explicit unit suffixes (`mm`, `cm`, `m`, `in`, `ft`) override the field's current mm/in toggle, and `+ - * /` with parentheses are supported, e.g. `15mm + (3/4*4)in`
- **Floor thickness / lip width safety readouts** that warn when a combination of depths would leave the wall or floor thinner than the current bit size (or cut through entirely)
- **Common bit size presets** (1/8", 1/4", 1/2", 3/6/8/16mm) alongside free-form entry
- **Optional Shaper Origin custom anchor marker** — a registration-point triangle (per [Shaper's custom anchor spec](https://support.shapertools.com/hc/en-us/articles/4402965445019-custom-anchors)) placed via a 9-point grid or a draggable custom position, baked identically into every generated file so the same physical mark registers all four passes
- **Bounding-box guide rectangle toggle** — off by default; the original app always includes this (invisible, zero-width-stroke) rect, this version makes it optional
- **Descriptive, numbered file names** — `Step 1 - Interior Roughing - Pentagon.svg`, `Step 2 - Interior - Pentagon.svg`, etc. (the original always used the fixed names `ReuleauxInteriorRoughing.svg`/`ReuleauxInterior.svg`/`ReuleauxExteriorRoughing.svg`/`ReuleauxExterior.svg`). The step numbers follow the original documentation's own "Order Of Operations" (interior roughing → interior → flip the wood → exterior roughing → exterior), and the shape name is the built-in shape (e.g. "Pentagon") or the uploaded file's own name for a custom shape
- **Machining mode** — generate both surfaces (the original's only option), or just interior/exterior only, for pieces that don't need the full two-sided carve
- **Custom profile curves** — draw the cross-section (depth vs. radius) by hand, pen-tool style, as an alternative to the original's fixed elliptical shape, independently for interior and/or exterior. For exterior specifically, this makes the foot optional — the curve itself defines everything from its own starting point out to the rim, with no separate foot height/diameter or relief pocket
- Live in-browser SVG preview and zip download — the original is a text-prompt CLI tool with no preview, and runs only on Windows

### Wave / Ripple Generator — new in this version

Not part of Reuleaux.exe at all. The original author documented a related but separate technique, [Wave Effect Surface Treatment](https://hub.shapertools.com/) (CC BY-NC-SA 4.0 — noncommercial, attribution, share-alike) — a manual Inkscape + spreadsheet workflow, not a tool. This turns that technique into a generator for parallel furrows, a tileable sine contour, or concentric diminishing rings.

### Chord / Flute Groove Generator — new in this version

Not part of Reuleaux.exe at all. The original author's documentation also includes "Chord calculations" for straight decorative grooves/flutes (e.g. fluted door staves) — a Pythagorean formula for the groove's depth profile, separate from both the bowl's elliptical cross-section and the wave technique's sine-based math. This turns that formula into a generator: a groove is modeled as a circular arc in cross-section (the radius is computed from the groove's width and center depth) and cut as a stack of parallel full-length passes stepped across the groove's width, each at the depth the arc calls for at that offset. Supports a single groove or multiple evenly-spaced parallel flutes, and shows the groove's computed radius of curvature as a readout (a round-nose/core-box bit of that radius would cut the same groove in one pass instead of many stepped ones).

Toggle between **Concave** (a dish-shaped groove cut into the surface — fluting) and **Convex** (a raised rounded bead, left standing by cutting down on either side — reeding), the same circular cross-section read the opposite way. For continuous reeding with no flat between adjacent beads, set the flute pitch equal to the groove width.

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
  tools/        bowl/, ripple/, and chord/ — orchestration + UI for each tool
  import/       browser-native SVG parsing for custom shape upload
tests/          geometry correctness, much of it validated against real sample output
```

## License / attribution

The bowl-generation technique and geometry are based on Andrew Weighill-Richards' original Reuleaux app and published documentation. The Wave Effect Surface Treatment technique specifically is CC BY-NC-SA 4.0 licensed by its author — noncommercial use, attribution, share-alike.
