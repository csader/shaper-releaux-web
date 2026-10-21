import { useMemo, useState } from "react";
import { generateMolding, type MoldingParams } from "./generate";
import { PathImport } from "./PathImport";
import { chordRadius, type ChordProfile } from "../../geometry/chord";
import { dedupeConsecutive, minRadiusOfCurvature } from "../../geometry/offsetPath";
import { boundingBox, type Point } from "../../geometry/customShape";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import type { Unit } from "../../units";
import { mmToDisplay, unitLabel } from "../../units";
import { NumberField } from "../../components/NumberField";

interface MoldingUiParams {
  profile: ChordProfile;
  widthMm: number;
  depthMm: number;
  stepMm: number;
  bitSize: number;
  flipSide: boolean;
  guideWidthMm: number;
}

const DEFAULTS: MoldingUiParams = {
  profile: "ogee",
  widthMm: 20,
  depthMm: 6,
  stepMm: 1,
  bitSize: 6,
  flipSide: false,
  guideWidthMm: 300,
};

/** Scales+shifts the raw imported points (in the SVG's own units) to real-world mm,
 * matching the user-entered guide curve width — same normalize-then-scale pattern as
 * the bowl's custom shape import, just against the bbox corner rather than a
 * centroid (an open polyline has no meaningful fillable-area centroid). */
function scaleGuideToMm(rawPoints: Point[], guideWidthMm: number): Point[] {
  const bbox = boundingBox(rawPoints);
  const rawWidth = bbox.maxX - bbox.minX || 1;
  const scale = guideWidthMm / rawWidth;
  const scaled = rawPoints.map((p) => ({ x: (p.x - bbox.minX) * scale, y: (p.y - bbox.minY) * scale }));
  return dedupeConsecutive(scaled);
}

export function MoldingTool({ unit }: { unit: Unit }) {
  const [params, setParams] = useState<MoldingUiParams>(DEFAULTS);
  const [rawPoints, setRawPoints] = useState<Point[] | null>(null);
  const set = <K extends keyof MoldingUiParams>(key: K, value: MoldingUiParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const guidePoints = useMemo(
    () => (rawPoints ? scaleGuideToMm(rawPoints, params.guideWidthMm) : null),
    [rawPoints, params.guideWidthMm],
  );

  const minRadius = guidePoints ? minRadiusOfCurvature(guidePoints) : Infinity;
  const halfWidth = params.widthMm / 2;
  const radius = chordRadius(halfWidth, params.depthMm);

  const files = useMemo(() => {
    if (!guidePoints || guidePoints.length < 2) return [];
    try {
      const moldingParams: MoldingParams = { ...params, guidePoints };
      return generateMolding(moldingParams);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [guidePoints, params]);

  return (
    <div className="tool">
      <div className="form">
        <p className="hint-note">
          Upload a curved guide shape (e.g. a pediment's edge) and run a cross-section profile along it — a curved
          generalization of the Chord tool, which only runs straight.
        </p>

        <PathImport onImport={setRawPoints} onSuggestedWidth={(mm) => set("guideWidthMm", mm)} />

        <NumberField
          label="Guide curve width"
          valueMm={params.guideWidthMm}
          onChangeMm={(v) => set("guideWidthMm", v)}
          unit={unit}
        />

        <div className="shape-source-toggle">
          <button className={params.profile === "concave" ? "active" : ""} onClick={() => set("profile", "concave")}>
            Concave (dish — fluting)
          </button>
          <button className={params.profile === "convex" ? "active" : ""} onClick={() => set("profile", "convex")}>
            Convex (arch — reeding)
          </button>
          <button className={params.profile === "ogee" ? "active" : ""} onClick={() => set("profile", "ogee")}>
            Ogee (S-curve)
          </button>
        </div>

        <NumberField label="Width" valueMm={params.widthMm} onChangeMm={(v) => set("widthMm", v)} unit={unit} />
        <NumberField label="Depth" valueMm={params.depthMm} onChangeMm={(v) => set("depthMm", v)} unit={unit} />

        {params.profile !== "ogee" && (
          <div className="field readout">
            <span>Computed radius</span>
            <span className="readout-value">
              {mmToDisplay(radius, unit)} {unitLabel(unit)}
            </span>
            <p className="hint-note">
              The cross-section's circular arc — doesn't apply to the ogee profile, which isn't a circular arc.
            </p>
          </div>
        )}

        <NumberField
          label="Step (spacing across width)"
          valueMm={params.stepMm}
          onChangeMm={(v) => set("stepMm", v)}
          unit={unit}
        />
        <NumberField label="Bit size" valueMm={params.bitSize} onChangeMm={(v) => set("bitSize", v)} unit={unit} />

        <label className="field checkbox-field">
          <input type="checkbox" checked={params.flipSide} onChange={(e) => set("flipSide", e.target.checked)} />
          <span>Flip side</span>
        </label>

        {guidePoints && (
          <div className={`field readout ${halfWidth > minRadius ? "readout-warning" : ""}`}>
            <span>Minimum radius of curvature along path</span>
            <span className="readout-value">
              {Number.isFinite(minRadius) ? `${mmToDisplay(minRadius, unit)} ${unitLabel(unit)}` : "∞ (straight)"}
            </span>
            {halfWidth > minRadius && (
              <p className="warning-note">
                The guide curve bends tighter than half the molding's width somewhere along its length — the
                cross-section will fold on itself there instead of cutting cleanly. Reduce the width, or expect
                artifacts at the tightest bend.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="preview">
        {files[0] && (
          <div>
            <h3>Preview</h3>
            <div className="svg-box" dangerouslySetInnerHTML={{ __html: files[0].content }} />
          </div>
        )}
        <div className="downloads">
          <p>
            {files.length} {files.length === 1 ? "file" : "files"} generated.
          </p>
          <button onClick={() => downloadAllAsZip(files, "reuleaux-molding.zip")}>Download all (.zip)</button>
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                {f.name} <button onClick={() => downloadFile(f)}>download</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
