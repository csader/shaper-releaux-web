import { useEffect, useMemo, useState } from "react";
import { extractDeclaredSizeMm, MAX_CANDIDATES, parseCandidateLoops, type Candidate } from "../../import/parseSvg";
import {
  compoundShapeToPathData,
  holeIsContained,
  isSimplePolygon,
  minVertexDistanceToPolygon,
  normalizeShape,
  scaleCompoundShape,
  type CompoundShape,
  type Loop,
} from "../../geometry/customShape";

interface Props {
  bitSize: number;
  mmCut: number;
  outerDiameter: number;
  onImport: (shape: CompoundShape | null) => void;
  /** Called with the file's declared real-world width (mm), when it has one. */
  onSuggestedWidth?: (mm: number) => void;
}

const PREVIEW_SCALES = [1, 0.5, 0.1];
// See the comment at the auto-suggest filter below.
const NEAR_DUPLICATE_AREA_RATIO = 0.9;

function boundingWidthOf(loop: Loop): number {
  let min = Infinity;
  let max = -Infinity;
  for (const p of loop) {
    min = Math.min(min, p.x);
    max = Math.max(max, p.x);
  }
  return max - min || 1;
}

function holesOverlap(a: Loop, b: Loop): boolean {
  return holeIsContained(a, b) || holeIsContained(b, a) || !isSimplePolygon([...a, ...b]);
}

export function CustomShapeImport({ bitSize, mmCut, outerDiameter, onImport, onSuggestedWidth }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [outerId, setOuterId] = useState<string | null>(null);
  const [holeIds, setHoleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  // null = no file uploaded yet; "none" = uploaded but it declares no physical units
  // (bare number / px / nothing) — distinguishes "haven't tried" from "tried, found
  // nothing", so the no-units warning only shows after an actual upload.
  const [declaredSize, setDeclaredSize] = useState<{ widthMm: number; heightMm: number } | "none" | null>(null);

  const outerCandidate = candidates.find((c) => c.id === outerId) ?? null;
  const holeCandidates = candidates.filter((c) => holeIds.has(c.id));

  // Flag candidates that are nearly the same size as the outer boundary (and inside
  // it) — almost always a stroke outlined-to-fill (e.g. Illustrator's "Outline
  // Stroke"), not an intentional hole. Shown as a hint next to the row either way,
  // since the user may have picked one manually even though it wasn't auto-suggested.
  const nearDuplicateIds = useMemo(() => {
    if (!outerCandidate) return new Set<string>();
    const ids = new Set<string>();
    for (const c of candidates) {
      if (c.id === outerCandidate.id) continue;
      if (c.area >= outerCandidate.area * NEAR_DUPLICATE_AREA_RATIO && holeIsContained(c.loop, outerCandidate.loop)) {
        ids.add(c.id);
      }
    }
    return ids;
  }, [candidates, outerCandidate]);

  const validation = useMemo(() => {
    if (!outerCandidate) return { ok: false, errors: [] as string[], warnings: [] as string[] };
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!isSimplePolygon(outerCandidate.loop)) {
      errors.push("The outer boundary self-intersects — pick a different shape or simplify it first.");
    }
    for (const hole of holeCandidates) {
      if (!isSimplePolygon(hole.loop)) {
        errors.push("One of the selected holes self-intersects.");
      } else if (!holeIsContained(hole.loop, outerCandidate.loop)) {
        errors.push("One of the selected holes isn't fully inside the outer boundary.");
      }
    }
    for (let i = 0; i < holeCandidates.length; i++) {
      for (let j = i + 1; j < holeCandidates.length; j++) {
        if (holesOverlap(holeCandidates[i].loop, holeCandidates[j].loop)) {
          errors.push("Selected holes overlap or nest inside each other — not supported.");
        }
      }
    }

    if (errors.length === 0) {
      const boundingWidth = boundingWidthOf(outerCandidate.loop);
      const minGapNormalized = holeCandidates.reduce(
        (min, h) => Math.min(min, minVertexDistanceToPolygon(h.loop, outerCandidate.loop) / boundingWidth),
        Infinity,
      );
      if (Number.isFinite(minGapNormalized)) {
        const minGapMm = minGapNormalized * outerDiameter;
        const required = bitSize + 2 * mmCut;
        if (minGapMm < required) {
          warnings.push(
            `The narrowest gap between a hole and the outer edge is ~${minGapMm.toFixed(1)}mm at full size, ` +
              `less than the bit clearance needed (${required.toFixed(1)}mm). Smaller rings will likely have the ` +
              `hole and outer wall merge — consider a smaller bit, larger mmCut, or a less tight shape.`,
          );
        }
      }
    }

    return { ok: errors.length === 0, errors, warnings };
  }, [outerCandidate, holeCandidates, bitSize, mmCut, outerDiameter]);

  const shape: CompoundShape | null =
    validation.ok && outerCandidate ? normalizeShape(outerCandidate.loop, holeCandidates.map((h) => h.loop)) : null;

  useEffect(() => {
    onImport(shape);
    // shape is a fresh object each render when valid; comparing by validity + ids
    // (via the dependency array below) avoids firing on every unrelated re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.ok, outerId, Array.from(holeIds).sort().join(",")]);

  function handleFile(file: File) {
    setError(null);
    setCandidates([]);
    setDeclaredSize(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        // Cheap fail-fast: this is almost always someone uploading a file this app
        // (or the original Reuleaux app) already exported — hundreds of concentric
        // toolpath rings, not a plain outline. Catch it before any DOM/sampling work.
        if (/\bshaper:cutDepth\b/.test(text)) {
          setError(
            "This looks like a Shaper Origin toolpath file (it has cutDepth encoding), not a plain decorative " +
              "outline — upload a single simple shape instead (e.g. one you drew or exported from a design tool).",
          );
          return;
        }
        const found = parseCandidateLoops(text);
        if (found.length === 0) {
          setError("No closed shapes found in this file.");
          return;
        }
        if (found.length > MAX_CANDIDATES) {
          setError(
            `Found over ${MAX_CANDIDATES} closed shapes in this file — that's too many for a simple outline ` +
              "import. Try a file with just one or two shapes (an outline, plus maybe a hole).",
          );
          return;
        }

        const size = extractDeclaredSizeMm(text);
        if (size) {
          setDeclaredSize(size);
          onSuggestedWidth?.(size.widthMm);
        } else {
          setDeclaredSize("none");
        }
        const sorted = [...found].sort((a, b) => b.area - a.area);
        const suggestedOuter = sorted[0];
        // "Contained" alone isn't enough to guess a candidate is a real hole: a stroke
        // outlined-to-fill in Illustrator (or similar) produces two nearly-identical
        // nested loops (the stroke's inner/outer edge), not a hole. A genuine hole is
        // normally meaningfully smaller than the outer boundary, so only auto-suggest
        // candidates well below the outer's area — the near-duplicate case is left for
        // the user to notice (flagged separately below) rather than silently carving
        // out almost the whole shape by default.
        const suggestedHoles = sorted
          .slice(1)
          .filter((c) => c.area < suggestedOuter.area * NEAR_DUPLICATE_AREA_RATIO && holeIsContained(c.loop, suggestedOuter.loop));
        setCandidates(found);
        setOuterId(suggestedOuter.id);
        setHoleIds(new Set(suggestedHoles.map((c) => c.id)));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not parse this file.");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="custom-import">
      <input
        type="file"
        accept=".svg,image/svg+xml"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      {error && <p className="error-note">{error}</p>}

      {declaredSize && declaredSize !== "none" && (
        <p className="hint-note">
          Detected real-world size: {declaredSize.widthMm.toFixed(1)}mm × {declaredSize.heightMm.toFixed(1)}mm —
          Outer width pre-filled below (you can still change it).
        </p>
      )}
      {declaredSize === "none" && (
        <p className="warning-note">
          This file doesn't declare physical units (mm/in/etc.) for its size — only its proportions were used.
          Set Outer width below to the real-world size you want.
        </p>
      )}

      {candidates.length === 1 && <p className="hint-note">1 closed shape found — using it as the outline.</p>}

      {candidates.length > 1 && (
        <div className="candidate-list">
          <p className="hint-note">{candidates.length} closed shapes found. Pick the outer boundary and any holes.</p>
          {candidates.map((c) => (
            <div key={c.id}>
              <label className="candidate-row">
                <input type="radio" name="outer" checked={outerId === c.id} onChange={() => setOuterId(c.id)} />
                <span>outer</span>
                <input
                  type="checkbox"
                  disabled={outerId === c.id}
                  checked={holeIds.has(c.id)}
                  onChange={(e) => {
                    const next = new Set(holeIds);
                    if (e.target.checked) next.add(c.id);
                    else next.delete(c.id);
                    setHoleIds(next);
                  }}
                />
                <span>hole</span>
                <span className="candidate-id">
                  {c.id} (area {Math.round(c.area)})
                </span>
              </label>
              {nearDuplicateIds.has(c.id) && (
                <p className="hint-note candidate-subnote">
                  Nearly the same size as the outer boundary — this usually means a stroke was outlined to a fill
                  (e.g. Illustrator's "Outline Stroke") rather than a real hole. Leave unchecked for a solid shape.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {validation.errors.map((e, i) => (
        <p key={i} className="error-note">
          {e}
        </p>
      ))}
      {validation.warnings.map((w, i) => (
        <p key={i} className="warning-note">
          {w}
        </p>
      ))}

      {shape && (
        <div className="scale-preview">
          {PREVIEW_SCALES.map((s) => (
            <div key={s} className="scale-preview-item">
              <svg viewBox="-60 -60 120 120" width="64" height="64">
                <path d={compoundShapeToPathData(scaleCompoundShape(shape, 100 * s, 0, 0))} fill="black" fillRule="evenodd" />
              </svg>
              <span>{Math.round(s * 100)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
