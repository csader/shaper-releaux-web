import { useMemo, useState } from "react";
import { generateRipple, type RippleParams, type RippleVariant } from "./generate";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import type { Unit } from "../../units";
import { NumberField } from "../../components/NumberField";

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
        <NumberField label="Max depth" valueMm={params.maxDepthMm} onChangeMm={(v) => set("maxDepthMm", v)} unit={unit} />
        <NumberField label="Spacing" valueMm={params.spacingMm} onChangeMm={(v) => set("spacingMm", v)} unit={unit} />
        <NumberField label="Wavelength" valueMm={params.wavelengthMm} onChangeMm={(v) => set("wavelengthMm", v)} unit={unit} />
        <NumberField label="Bit size" valueMm={params.bitSize} onChangeMm={(v) => set("bitSize", v)} unit={unit} />
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
