import { useMemo, useRef, useState } from "react";
import { generateChord, type ChordParams } from "./generate";
import { chordParamsToFields, parseChordParams } from "./paramsFile";
import { serializeParamsFile } from "../../params/paramsFile";
import { chordRadius } from "../../geometry/chord";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import type { Unit } from "../../units";
import { mmToDisplay, unitLabel } from "../../units";
import { NumberField } from "../../components/NumberField";
import { UploadIcon } from "../../icons/UploadIcon";

const DEFAULTS: ChordParams = {
  profile: "concave",
  grooveWidthMm: 58,
  grooveDepthMm: 9.5,
  lengthMm: 300,
  stepMm: 1,
  fluteCount: 1,
  flutePitchMm: 80,
  bitSize: 6,
};

export function ChordTool({ unit }: { unit: Unit }) {
  const [params, setParams] = useState<ChordParams>(DEFAULTS);
  const paramsFileInputRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ChordParams>(key: K, value: ChordParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));

  const files = useMemo(() => {
    try {
      return generateChord(params);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [params]);

  const radius = chordRadius(params.grooveWidthMm / 2, params.grooveDepthMm);

  const downloadFiles = useMemo(
    () => [...files, { name: "Parameters.txt", content: serializeParamsFile("Chord", chordParamsToFields(params)) }],
    [files, params],
  );

  function handleImportParams(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setParams(parseChordParams(String(reader.result ?? ""), DEFAULTS));
    };
    reader.readAsText(file);
  }

  return (
    <div className="tool">
      <div className="form">
        <p className="license-note">
          Technique by Andrew Weighill-Richards, licensed CC BY-NC-SA 4.0 (noncommercial, attribution, share-alike).
        </p>
        <p className="hint-note">
          A straight decorative groove, cut as a stack of parallel passes stepped across the groove's width, each at
          the depth its circular cross-section calls for at that offset.
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
        <div className="shape-source-toggle">
          <button className={params.profile === "concave" ? "active" : ""} onClick={() => set("profile", "concave")}>
            Concave (dish — fluting, cut into the surface)
          </button>
          <button className={params.profile === "convex" ? "active" : ""} onClick={() => set("profile", "convex")}>
            Convex (arch — reeding, a raised rounded bead)
          </button>
          <button className={params.profile === "ogee" ? "active" : ""} onClick={() => set("profile", "ogee")}>
            Ogee (S-curve)
          </button>
        </div>
        <NumberField
          label="Groove width (chord)"
          valueMm={params.grooveWidthMm}
          onChangeMm={(v) => set("grooveWidthMm", v)}
          unit={unit}
        />
        <NumberField
          label={
            params.profile === "concave"
              ? "Groove depth (at centerline)"
              : params.profile === "convex"
                ? "Bead height (depth cut at the edges)"
                : "Depth (ramp from 0 at one edge to full depth at the other)"
          }
          valueMm={params.grooveDepthMm}
          onChangeMm={(v) => set("grooveDepthMm", v)}
          unit={unit}
        />
        {params.profile !== "ogee" && (
          <div className="field readout">
            <span>Computed radius</span>
            <span className="readout-value">
              {mmToDisplay(radius, unit)} {unitLabel(unit)}
            </span>
            <p className="hint-note">
              The groove's circular cross-section — a round-nose/core-box bit of this radius would cut it in one
              pass instead of many stepped ones.
            </p>
          </div>
        )}
        <NumberField label="Length" valueMm={params.lengthMm} onChangeMm={(v) => set("lengthMm", v)} unit={unit} />
        <NumberField
          label="Step (spacing across groove width)"
          valueMm={params.stepMm}
          onChangeMm={(v) => set("stepMm", v)}
          unit={unit}
        />
        <label className="field">
          <span>Flute count</span>
          <input
            type="number"
            min={1}
            step={1}
            value={params.fluteCount}
            onChange={(e) => set("fluteCount", Math.max(1, Math.round(Number(e.target.value))))}
          />
        </label>
        {params.fluteCount > 1 && (
          <>
            <NumberField
              label="Flute pitch (center-to-center)"
              valueMm={params.flutePitchMm}
              onChangeMm={(v) => set("flutePitchMm", v)}
              unit={unit}
            />
            {params.profile === "convex" && (
              <p className="hint-note">
                For continuous reeding with no flat between beads, set pitch equal to groove width — each bead then
                reaches full depth right where the next one starts.
              </p>
            )}
          </>
        )}
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
          <button onClick={() => downloadAllAsZip(downloadFiles, "reuleaux-chord.zip")}>Download all (.zip)</button>
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
