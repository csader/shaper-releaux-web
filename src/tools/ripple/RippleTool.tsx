import { useMemo, useState } from "react";
import { generateRipple, type RippleParams, type RippleVariant } from "./generate";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import { displayToMm, mmToDisplay, unitLabel, type Unit } from "../../units";

const DEFAULTS: RippleParams = {
  variant: "diminishingRings",
  widthMm: 150,
  heightMm: 150,
  maxDepthMm: 6,
  spacingMm: 1,
  wavelengthMm: 20,
  bitSize: 8,
};

const VARIANT_LABELS: Record<RippleVariant, string> = {
  furrows: "Parallel furrows",
  sineContour: "Tileable sine contour",
  diminishingRings: "Concentric diminishing rings",
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

export function RippleTool({ unit }: { unit: Unit }) {
  const [params, setParams] = useState<RippleParams>(DEFAULTS);
  const set = <K extends keyof RippleParams>(key: K, value: RippleParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const files = useMemo(() => {
    try {
      return generateRipple(params);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [params]);

  return (
    <div className="tool">
      <div className="form">
        <p className="license-note">
          Technique by Andrew Weighill-Richards, licensed CC BY-NC-SA 4.0 (noncommercial, attribution, share-alike).
        </p>
        <label className="field">
          <span>Variant</span>
          <select value={params.variant} onChange={(e) => set("variant", e.target.value as RippleVariant)}>
            {Object.entries(VARIANT_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Width" valueMm={params.widthMm} onChangeMm={(v) => set("widthMm", v)} unit={unit} />
        <NumberField label="Height" valueMm={params.heightMm} onChangeMm={(v) => set("heightMm", v)} unit={unit} />
        <NumberField label="Max depth" valueMm={params.maxDepthMm} onChangeMm={(v) => set("maxDepthMm", v)} unit={unit} step={0.5} />
        <NumberField label="Spacing" valueMm={params.spacingMm} onChangeMm={(v) => set("spacingMm", v)} unit={unit} step={0.1} />
        <NumberField label="Wavelength" valueMm={params.wavelengthMm} onChangeMm={(v) => set("wavelengthMm", v)} unit={unit} />
        <NumberField label="Bit size" valueMm={params.bitSize} onChangeMm={(v) => set("bitSize", v)} unit={unit} step={0.5} />
      </div>

      <div className="preview">
        {files[0] && (
          <div>
            <h3>Preview</h3>
            <div className="svg-box" dangerouslySetInnerHTML={{ __html: files[0].content }} />
          </div>
        )}
        <div className="downloads">
          <p>{files.length} file(s) generated.</p>
          <button onClick={() => downloadAllAsZip(files, "reuleaux-ripple.zip")}>Download all (.zip)</button>
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
