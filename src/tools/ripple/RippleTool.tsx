import { useMemo, useRef, useState } from "react";
import { generateRipple, type RippleParams, type RippleVariant } from "./generate";
import { parseRippleParams, rippleParamsToFields } from "./paramsFile";
import { serializeParamsFile } from "../../params/paramsFile";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import type { Unit } from "../../units";
import { NumberField } from "../../components/NumberField";
import { UploadIcon } from "../../icons/UploadIcon";

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
  const paramsFileInputRef = useRef<HTMLInputElement>(null);
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

  const downloadFiles = useMemo(
    () => [...files, { name: "Parameters.txt", content: serializeParamsFile("Ripple", rippleParamsToFields(params)) }],
    [files, params],
  );

  function handleImportParams(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setParams(parseRippleParams(String(reader.result ?? ""), DEFAULTS));
    };
    reader.readAsText(file);
  }

  return (
    <div className="tool">
      <div className="form">
        <p className="license-note">
          Technique by Andrew Weighill-Richards, licensed CC BY-NC-SA 4.0 (noncommercial, attribution, share-alike).
        </p>

        <div className="params-header">
          <button
            type="button"
            className="upload-icon-button"
            title="Upload Parameters File"
            aria-label="Upload Parameters File"
            onClick={() => paramsFileInputRef.current?.click()}
          >
            <UploadIcon />
          </button>
          <h3>Parameters</h3>
          <input
            ref={paramsFileInputRef}
            type="file"
            accept=".txt,text/plain"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImportParams(file);
              e.target.value = "";
            }}
          />
        </div>

        <div className="param-group">
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
            {downloadFiles.length} {downloadFiles.length === 1 ? "file" : "files"} generated.
          </p>
          <button onClick={() => downloadAllAsZip(downloadFiles, "reuleaux-ripple.zip")}>Download all (.zip)</button>
          <ul>
            {downloadFiles.map((f) => (
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
