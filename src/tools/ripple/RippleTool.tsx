import { useMemo, useState } from "react";
import { generateRipple, type RippleParams, type RippleVariant } from "./generate";
import { downloadAllAsZip, downloadFile } from "../../download/download";

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

export function RippleTool() {
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
        <NumberField label="Width (mm)" value={params.widthMm} onChange={(v) => set("widthMm", v)} />
        <NumberField label="Height (mm)" value={params.heightMm} onChange={(v) => set("heightMm", v)} />
        <NumberField label="Max depth (mm)" value={params.maxDepthMm} onChange={(v) => set("maxDepthMm", v)} step={0.5} />
        <NumberField label="Spacing (mm)" value={params.spacingMm} onChange={(v) => set("spacingMm", v)} step={0.1} />
        <NumberField label="Wavelength (mm)" value={params.wavelengthMm} onChange={(v) => set("wavelengthMm", v)} />
        <NumberField label="Bit size (mm)" value={params.bitSize} onChange={(v) => set("bitSize", v)} step={0.5} />
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
