import { useMemo, useState } from "react";
import { generateBowl, type BowlParams } from "./generate";
import type { Sides } from "../../geometry/shapes";
import type { SteppingModel } from "../../geometry/profile";
import { downloadAllAsZip, downloadFile } from "../../download/download";

const SIDE_LABELS: Record<Sides, string> = {
  1: "1 — Circle / Ellipse",
  2: "2 — Heart",
  3: "3 — Reuleaux triangle",
  4: "4 — Square",
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
};

function NumberField({
  label,
  value,
  onChange,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type="number" step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} />
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

export function BowlTool() {
  const [params, setParams] = useState<BowlParams>(DEFAULTS);
  const set = <K extends keyof BowlParams>(key: K, value: BowlParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const files = useMemo(() => {
    try {
      return generateBowl(params);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [params]);

  const exteriorPreview = files.find((f) => f.name.startsWith("ReuleauxExterior") && !f.name.includes("Roughing"));
  const interiorPreview = files.find((f) => f.name.startsWith("ReuleauxInterior") && !f.name.includes("Roughing"));

  return (
    <div className="tool">
      <div className="form">
        <label className="field">
          <span>Number of sides</span>
          <select value={params.sides} onChange={(e) => set("sides", Number(e.target.value) as Sides)}>
            {Object.entries(SIDE_LABELS).map(([n, label]) => (
              <option key={n} value={n}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Outer diameter (mm)" value={params.outerDiameter} onChange={(v) => set("outerDiameter", v)} />
        <NumberField label="Inner diameter (mm)" value={params.innerDiameter} onChange={(v) => set("innerDiameter", v)} />
        <NumberField label="Outer depth (mm)" value={params.outerDepth} onChange={(v) => set("outerDepth", v)} />
        <NumberField label="Inner depth (mm)" value={params.innerDepth} onChange={(v) => set("innerDepth", v)} />
        <NumberField label="Foot height (mm)" value={params.footHeight} onChange={(v) => set("footHeight", v)} />
        <NumberField label="Foot diameter (mm)" value={params.footDiameter} onChange={(v) => set("footDiameter", v)} />
        <NumberField label="Z-touch height (mm)" value={params.zTouchHeight} onChange={(v) => set("zTouchHeight", v)} />
        <NumberField label="Bit size (mm)" value={params.bitSize} onChange={(v) => set("bitSize", v)} step={0.5} />
        <NumberField label="MM cut (width of cut paths)" value={params.mmCut} onChange={(v) => set("mmCut", v)} step={0.1} />
        <ModelToggle label="Interior finishing model" value={params.interiorModel} onChange={(v) => set("interiorModel", v)} />
        <ModelToggle label="Exterior finishing model" value={params.exteriorModel} onChange={(v) => set("exteriorModel", v)} />
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
