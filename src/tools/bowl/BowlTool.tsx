import { useMemo, useState } from "react";
import { generateBowl, type BowlParams } from "./generate";
import { CustomShapeImport } from "./CustomShapeImport";
import type { Sides } from "../../geometry/shapes";
import type { SteppingModel } from "../../geometry/profile";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import { displayToMm, mmToDisplay, unitLabel, type Unit } from "../../units";

const SIDE_LABELS: Record<Sides, string> = {
  1: "1 — Circle / Ellipse",
  2: "2 — Heart",
  3: "3 — Reuleaux triangle",
  4: "4 — Square / Rectangle",
  5: "5 — Reuleaux pentagon",
  6: "6 — Hexagon",
  7: "7 — Reuleaux heptagon",
};

const DEFAULTS: BowlParams = {
  sides: 5,
  outerDiameter: 250,
  innerDiameter: 234,
  outerDepth: 60,
  innerDepth: 50,
  footHeight: 2,
  footDiameter: 125,
  zTouchHeight: 50,
  bitSize: 8,
  mmCut: 0.5,
  interiorModel: "circumferential",
  exteriorModel: "circumferential",
  footRelief: true,
};

function NumberField({
  label,
  valueMm,
  onChangeMm,
  unit,
  step = 1,
}: {
  label: string;
  valueMm: number;
  onChangeMm: (mm: number) => void;
  unit: Unit;
  step?: number;
}) {
  return (
    <label className="field">
      <span>
        {label} ({unitLabel(unit)})
      </span>
      <input
        type="number"
        step={step}
        value={mmToDisplay(valueMm, unit)}
        onChange={(e) => onChangeMm(displayToMm(parseFloat(e.target.value) || 0, unit))}
      />
    </label>
  );
}

function ModelToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SteppingModel;
  onChange: (v: SteppingModel) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as SteppingModel)}>
        <option value="circumferential">Circumferential (default, most consistent)</option>
        <option value="radial">Radial (simpler math, more variable width)</option>
      </select>
    </label>
  );
}

type ShapeSource = "upload" | "builtin";

export function BowlTool({ unit }: { unit: Unit }) {
  const [params, setParams] = useState<BowlParams>(DEFAULTS);
  const [independentAxes, setIndependentAxes] = useState(false);
  const [shapeSource, setShapeSource] = useState<ShapeSource>("builtin");
  const set = <K extends keyof BowlParams>(key: K, value: BowlParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const supportsIndependentAxes = shapeSource === "builtin" && (params.sides === 1 || params.sides === 4);
  const isCustom = shapeSource === "upload";

  const files = useMemo(() => {
    if (isCustom && !params.customShape) return [];
    try {
      return generateBowl(params);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [params, isCustom]);

  const exteriorPreview = files.find((f) => f.name.startsWith("ReuleauxExterior") && !f.name.includes("Roughing"));
  const interiorPreview = files.find((f) => f.name.startsWith("ReuleauxInterior") && !f.name.includes("Roughing"));

  return (
    <div className="tool">
      <div className="form">
        <div className="shape-source-toggle">
          <button
            className={shapeSource === "upload" ? "active" : ""}
            onClick={() => {
              setShapeSource("upload");
              set("sides", "custom");
            }}
          >
            Upload SVG
          </button>
          <button
            className={shapeSource === "builtin" ? "active" : ""}
            onClick={() => {
              setShapeSource("builtin");
              setIndependentAxes(false);
              setParams((p) => ({ ...p, sides: DEFAULTS.sides, customShape: undefined }));
            }}
          >
            Choose a built-in shape
          </button>
        </div>

        {isCustom && (
          <>
            <CustomShapeImport
              bitSize={params.bitSize}
              mmCut={params.mmCut}
              outerDiameter={params.outerDiameter}
              onImport={(shape) => set("customShape", shape ?? undefined)}
            />
            <p className="hint-note">
              Custom shapes can produce large files with the circumferential model — radial is a lighter default
              here.
            </p>
          </>
        )}

        {shapeSource === "builtin" && (
          <label className="field">
            <span>Number of sides</span>
            <select
              value={params.sides === "custom" ? 5 : params.sides}
              onChange={(e) => {
                const sides = Number(e.target.value) as Sides;
                set("sides", sides);
                if (sides !== 1 && sides !== 4) setIndependentAxes(false);
              }}
            >
              {Object.entries(SIDE_LABELS).map(([n, label]) => (
                <option key={n} value={n}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        {supportsIndependentAxes && (
          <label className="field checkbox-field">
            <input
              type="checkbox"
              checked={independentAxes}
              onChange={(e) => {
                setIndependentAxes(e.target.checked);
                if (!e.target.checked) {
                  set("outerDiameterY", undefined);
                  set("innerDiameterY", undefined);
                }
              }}
            />
            <span>{params.sides === 1 ? "Independent X/Y (ellipse)" : "Independent X/Y (rectangle)"}</span>
          </label>
        )}

        <NumberField label="Outer diameter" valueMm={params.outerDiameter} onChangeMm={(v) => set("outerDiameter", v)} unit={unit} />
        {independentAxes && (
          <NumberField
            label="Outer diameter Y"
            valueMm={params.outerDiameterY ?? params.outerDiameter}
            onChangeMm={(v) => set("outerDiameterY", v)}
            unit={unit}
          />
        )}
        <NumberField label="Inner diameter" valueMm={params.innerDiameter} onChangeMm={(v) => set("innerDiameter", v)} unit={unit} />
        {independentAxes && (
          <NumberField
            label="Inner diameter Y"
            valueMm={params.innerDiameterY ?? params.innerDiameter}
            onChangeMm={(v) => set("innerDiameterY", v)}
            unit={unit}
          />
        )}
        <NumberField label="Outer depth" valueMm={params.outerDepth} onChangeMm={(v) => set("outerDepth", v)} unit={unit} />
        <NumberField label="Inner depth" valueMm={params.innerDepth} onChangeMm={(v) => set("innerDepth", v)} unit={unit} />
        <NumberField label="Foot height" valueMm={params.footHeight} onChangeMm={(v) => set("footHeight", v)} unit={unit} />
        <NumberField label="Foot diameter" valueMm={params.footDiameter} onChangeMm={(v) => set("footDiameter", v)} unit={unit} />
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={params.footRelief ?? true}
            onChange={(e) => set("footRelief", e.target.checked)}
          />
          <span>Include foot relief pocket</span>
        </label>
        <NumberField label="Z-touch height" valueMm={params.zTouchHeight} onChangeMm={(v) => set("zTouchHeight", v)} unit={unit} />
        <NumberField label="Bit size" valueMm={params.bitSize} onChangeMm={(v) => set("bitSize", v)} unit={unit} step={0.5} />
        <NumberField label="MM cut (width of cut paths)" valueMm={params.mmCut} onChangeMm={(v) => set("mmCut", v)} unit={unit} step={0.1} />
        <ModelToggle label="Interior finishing model" value={params.interiorModel} onChange={(v) => set("interiorModel", v)} />
        <ModelToggle label="Exterior finishing model" value={params.exteriorModel} onChange={(v) => set("exteriorModel", v)} />
        {params.footRelief !== false && (
          <p className="hint-note">
            A foot relief pocket is included automatically in the roughing file when there's room for it.
          </p>
        )}
      </div>

      <div className="preview">
        <div className="preview-pair">
          {exteriorPreview && (
            <div>
              <h3>Exterior</h3>
              <div className="svg-box" dangerouslySetInnerHTML={{ __html: exteriorPreview.content }} />
            </div>
          )}
          {interiorPreview && (
            <div>
              <h3>Interior</h3>
              <div className="svg-box" dangerouslySetInnerHTML={{ __html: interiorPreview.content }} />
            </div>
          )}
        </div>

        <div className="downloads">
          <p>{files.length} file(s) generated.</p>
          <button onClick={() => downloadAllAsZip(files, "reuleaux-bowl.zip")}>Download all (.zip)</button>
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
