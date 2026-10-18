import { useEffect, useMemo, useState } from "react";
import { MAX_CANDIDATES, parseCandidateLoops, type Candidate } from "../../import/parseSvg";
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
}

const PREVIEW_SCALES = [1, 0.5, 0.1];

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

export function CustomShapeImport({ bitSize, mmCut, outerDiameter, onImport }: Props) {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [outerId, setOuterId] = useState<string | null>(null);
  const [holeIds, setHoleIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const outerCandidate = candidates.find((c) => c.id === outerId) ?? null;
  const holeCandidates = candidates.filter((c) => holeIds.has(c.id));

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
        const sorted = [...found].sort((a, b) => b.area - a.area);
        const suggestedOuter = sorted[0];
        const suggestedHoles = sorted.slice(1).filter((c) => holeIsContained(c.loop, suggestedOuter.loop));
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

      {candidates.length > 0 && (
        <div className="candidate-list">
          <p className="hint-note">{candidates.length} closed shape(s) found. Pick the outer boundary and any holes.</p>
          {candidates.map((c) => (
            <label key={c.id} className="candidate-row">
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
