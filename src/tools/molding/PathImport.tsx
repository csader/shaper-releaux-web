import { useEffect, useState } from "react";
import { extractDeclaredSizeMm } from "../../import/parseSvg";
import { MAX_CANDIDATES, parseOpenPathCandidates, type PathCandidate } from "../../import/parseOpenPath";
import { boundingBox, type Point } from "../../geometry/customShape";

interface Props {
  onImport: (points: Point[] | null) => void;
  /** Called with the file's declared real-world width (mm), when it has one. */
  onSuggestedWidth?: (mm: number) => void;
  /** Called with the uploaded file's name (sans extension), for use in export file naming. */
  onFileName?: (name: string) => void;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, "");
}

/** Scales an open point sequence to fit within a `size`x`size` box centered at the
 * origin, for the small on-screen preview only — not related to the real-world mm
 * scaling the tool applies once a guide curve width is entered. */
function previewPathData(points: Point[], size: number): string {
  const bbox = boundingBox(points);
  const w = bbox.maxX - bbox.minX || 1;
  const h = bbox.maxY - bbox.minY || 1;
  const scale = size / Math.max(w, h);
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const scaled = points.map((p) => ({ x: (p.x - cx) * scale, y: (p.y - cy) * scale }));
  const [first, ...rest] = scaled;
  return `M ${first.x},${first.y} L ${rest.map((p) => `${p.x},${p.y}`).join(" L ")}`;
}

export function PathImport({ onImport, onSuggestedWidth, onFileName }: Props) {
  const [candidates, setCandidates] = useState<PathCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // null = no file uploaded yet; "none" = uploaded but it declares no physical units.
  const [declaredSize, setDeclaredSize] = useState<{ widthMm: number; heightMm: number } | "none" | null>(null);

  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  useEffect(() => {
    onImport(selected?.points ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function handleFile(file: File) {
    setError(null);
    setCandidates([]);
    setSelectedId(null);
    setDeclaredSize(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        if (/\bshaper:cutDepth\b/.test(text)) {
          setError(
            "This looks like a Shaper Origin toolpath file (it has cutDepth encoding), not a plain guide curve — " +
              "upload a single simple curve instead (e.g. one you drew or exported from a design tool).",
          );
          return;
        }
        const found = parseOpenPathCandidates(text);
        if (found.length === 0) {
          setError("No usable curves found in this file.");
          return;
        }
        if (found.length > MAX_CANDIDATES) {
          setError(
            `Found over ${MAX_CANDIDATES} shapes in this file — that's too many for a simple guide curve import. ` +
              "Try a file with just one or two shapes.",
          );
          return;
        }

        onFileName?.(stripExtension(file.name));

        const size = extractDeclaredSizeMm(text);
        if (size) {
          setDeclaredSize(size);
          onSuggestedWidth?.(size.widthMm);
        } else {
          setDeclaredSize("none");
        }

        // Auto-suggest the longest candidate — the open-path analog of "largest area
        // = outer boundary" (a pediment's own guide edge is usually the longest curve
        // in the file; short decorative bits are usually something else).
        const sorted = [...found].sort((a, b) => b.lengthMm - a.lengthMm);
        setCandidates(found);
        setSelectedId(sorted[0].id);
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
          Guide curve width pre-filled below (you can still change it).
        </p>
      )}
      {declaredSize === "none" && (
        <p className="warning-note">
          This file doesn't declare physical units (mm/in/etc.) for its size — only its proportions were used. Set
          the guide curve width below to the real-world size you want.
        </p>
      )}

      {candidates.length === 1 && <p className="hint-note">1 curve found — using it as the guide path.</p>}

      {candidates.length > 1 && (
        <div className="candidate-list">
          <p className="hint-note">{candidates.length} curves found. Pick the one to use as the guide path.</p>
          {candidates.map((c) => (
            <label key={c.id} className="candidate-row">
              <input type="radio" name="guide" checked={selectedId === c.id} onChange={() => setSelectedId(c.id)} />
              <span className="candidate-id">
                {c.id} (length {Math.round(c.lengthMm)})
              </span>
            </label>
          ))}
        </div>
      )}

      {selected && (
        <div className="scale-preview">
          <div className="scale-preview-item">
            <svg viewBox="-60 -60 120 120" width="64" height="64">
              <path d={previewPathData(selected.points, 100)} fill="none" stroke="black" strokeWidth="2" />
            </svg>
            <span>guide curve preview</span>
          </div>
        </div>
      )}
    </div>
  );
}
