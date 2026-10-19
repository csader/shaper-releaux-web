import { useMemo, useRef, useState } from "react";
import { generateBowl, boundingBoxFor, shapeCenterFor, type BowlParams } from "./generate";
import { CustomShapeImport } from "./CustomShapeImport";
import type { Sides } from "../../geometry/shapes";
import type { SteppingModel } from "../../geometry/profile";
import { downloadAllAsZip, downloadFile } from "../../download/download";
import { displayToMm, mmToDisplay, unitLabel, type Unit } from "../../units";
import { shadePreviewSvg } from "../../svg/previewShading";
import { resolveAnchorPoint, type AnchorConfig, type AnchorPosition, type BoundingBox } from "../../svg/anchor";

const SIDE_LABELS: Record<Sides, string> = {
  1: "1 — Circle / Ellipse",
  2: "2 — Heart",
  3: "3 — Reuleaux triangle",
  4: "4 — Square / Rectangle",
  5: "5 — Reuleaux pentagon",
  6: "6 — Hexagon",
  7: "7 — Reuleaux heptagon",
};

const BIT_PRESETS: { label: string; mm: number }[] = [
  { label: '1/8"', mm: 0.125 * 25.4 },
  { label: '1/4"', mm: 0.25 * 25.4 },
  { label: '1/2"', mm: 0.5 * 25.4 },
  { label: "3mm", mm: 3 },
  { label: "6mm", mm: 6 },
  { label: "8mm", mm: 8 },
  { label: "16mm", mm: 16 },
];

const ANCHOR_GRID: { position: AnchorPosition; label: string }[] = [
  { position: "top-left", label: "Top left" },
  { position: "top-center", label: "Top center" },
  { position: "top-right", label: "Top right" },
  { position: "middle-left", label: "Middle left" },
  { position: "center", label: "Center" },
  { position: "middle-right", label: "Middle right" },
  { position: "bottom-left", label: "Bottom left" },
  { position: "bottom-center", label: "Bottom center" },
  { position: "bottom-right", label: "Bottom right" },
];

const DEFAULT_ANCHOR: AnchorConfig = { enabled: true, position: "center" };

const DEFAULTS: BowlParams = {
  sides: 5,
  outerDiameter: 250,
  innerDiameter: 234,
  outerDepth: 60,
  innerDepth: 50,
  footHeight: 2,
  footDiameter: 125,
  zTouchHeight: 60,
  bitSize: 8,
  mmCut: 0.5,
  interiorModel: "circumferential",
  exteriorModel: "circumferential",
  footRelief: true,
  maxPathsPerFile: 250,
  anchor: DEFAULT_ANCHOR,
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

/** Plain integer input, no unit conversion — e.g. a path count, not a physical size. */
function IntegerField({
  label,
  value,
  onChange,
  min = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        step={1}
        min={min}
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.round(parseFloat(e.target.value) || min)))}
      />
    </label>
  );
}

/** Read-only computed value (not a user input) — e.g. floor thickness or lip width,
 * derived from other fields. Flips to warning styling below `warnIfBelowMm`. */
function Readout({
  label,
  valueMm,
  unit,
  warnIfBelowMm,
  warningText,
}: {
  label: string;
  valueMm: number;
  unit: Unit;
  warnIfBelowMm?: number;
  warningText?: string;
}) {
  const isWarning = warnIfBelowMm !== undefined && valueMm < warnIfBelowMm;
  return (
    <div className={`field readout ${isWarning ? "readout-warning" : ""}`}>
      <span>{label}</span>
      <span className="readout-value">
        {mmToDisplay(valueMm, unit)} {unitLabel(unit)}
      </span>
      {isWarning && warningText && <p className="warning-note">{warningText}</p>}
    </div>
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

/** Invisible drag hit-area over the exterior preview, active only in "custom"
 * position mode. No visual of its own — the real anchor marker (the red triangle
 * already baked into the previewed SVG, kept on top by shadePreviewSvg) is what's
 * visible; this just translates pointer drags on top of it into mm coordinates. */
function AnchorOverlay({ box, onDrag }: { box: BoundingBox; onDrag: (xMm: number, yMm: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    onDrag(box.originX + nx * box.width, box.originY + ny * box.height);
  };
  return (
    <svg
      ref={ref}
      className="anchor-overlay"
      onPointerDown={(e) => {
        ref.current?.setPointerCapture(e.pointerId);
        handlePointer(e);
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) handlePointer(e);
      }}
    />
  );
}

type ShapeSource = "upload" | "builtin";

export function BowlTool({ unit }: { unit: Unit }) {
  const [params, setParams] = useState<BowlParams>(DEFAULTS);
  const [independentAxes, setIndependentAxes] = useState(false);
  const [shapeSource, setShapeSource] = useState<ShapeSource>("builtin");
  // Per the original app's own documentation: "If you aren't using a Z touch
  // reference block, this value should be the same as for the OuterDepth parameter."
  // Most bowls don't need the multi-bit workflow, so Z-touch height tracks Outer
  // depth automatically unless this is on — avoids a stale, silently-wrong value if
  // Outer depth changes later.
  const [useZTouchBlock, setUseZTouchBlock] = useState(false);
  // Most bowls use the same stepping model for both surfaces — one shared control by
  // default, with an escape hatch for the (new-in-this-version, not in the original
  // app) per-surface split.
  const [independentFinishingModel, setIndependentFinishingModel] = useState(false);
  const set = <K extends keyof BowlParams>(key: K, value: BowlParams[K]) =>
    setParams((p) => ({ ...p, [key]: value }));
  const setBothModels = (v: BowlParams["interiorModel"]) =>
    setParams((p) => ({ ...p, interiorModel: v, exteriorModel: v }));
  const effectiveZTouchHeight = useZTouchBlock ? params.zTouchHeight : params.outerDepth;

  const supportsIndependentAxes = shapeSource === "builtin" && (params.sides === 1 || params.sides === 4);
  const isCustom = shapeSource === "upload";

  // Not single-valued around the whole profile (the exterior/interior gap varies
  // continuously), so these are the two specific points that actually matter: the
  // lip (nominal, at the corners for non-circular shapes — it narrows slightly
  // elsewhere, per the readme) and the floor at the bowl's deepest point.
  const lipWidth = (params.outerDiameter - params.innerDiameter) / 2;
  const floorThickness = params.outerDepth - params.innerDepth - params.footHeight;

  const boundingBox = boundingBoxFor(params);
  const shapeCenter = shapeCenterFor(params);
  const anchorPreviewPoint = params.anchor?.enabled
    ? resolveAnchorPoint(params.anchor, boundingBox, { x: shapeCenter.cx, y: shapeCenter.cy })
    : null;

  const files = useMemo(() => {
    if (isCustom && !params.customShape) return [];
    try {
      return generateBowl({ ...params, zTouchHeight: effectiveZTouchHeight });
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [params, isCustom, effectiveZTouchHeight]);

  const exteriorPreview = files.find((f) => f.kind === "exterior");
  const interiorPreview = files.find((f) => f.kind === "interior");
  const exteriorPreviewHtml = useMemo(
    () => (exteriorPreview ? shadePreviewSvg(exteriorPreview.content) : ""),
    [exteriorPreview],
  );
  const interiorPreviewHtml = useMemo(
    () => (interiorPreview ? shadePreviewSvg(interiorPreview.content) : ""),
    [interiorPreview],
  );

  return (
    <div className="tool">
      <div className="form">
        <div className="shape-source-toggle">
          <button
            className={shapeSource === "builtin" ? "active" : ""}
            onClick={() => {
              setShapeSource("builtin");
              setIndependentAxes(false);
              setParams((p) => ({ ...p, sides: DEFAULTS.sides, customShape: undefined, customShapeName: undefined }));
            }}
          >
            Choose a built-in shape
          </button>
          <button
            className={shapeSource === "upload" ? "active" : ""}
            onClick={() => {
              setShapeSource("upload");
              set("sides", "custom");
            }}
          >
            Upload SVG
          </button>
        </div>

        {isCustom && (
          <>
            <CustomShapeImport
              bitSize={params.bitSize}
              mmCut={params.mmCut}
              outerDiameter={params.outerDiameter}
              onImport={(shape) => set("customShape", shape ?? undefined)}
              onSuggestedWidth={(mm) => set("outerDiameter", mm)}
              onFileName={(name) => set("customShapeName", name)}
            />
            <p className="hint-note">
              Custom shapes can produce large files with the circumferential model — radial is a lighter default
              here.
            </p>
            <p className="hint-note">
              The uploaded outline only sets proportions — Outer/Inner width below still set the real-world size,
              same as for a built-in shape.
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

        {independentFinishingModel ? (
          <>
            <ModelToggle label="Interior finishing model" value={params.interiorModel} onChange={(v) => set("interiorModel", v)} />
            <ModelToggle label="Exterior finishing model" value={params.exteriorModel} onChange={(v) => set("exteriorModel", v)} />
          </>
        ) : (
          <ModelToggle label="Finishing model" value={params.interiorModel} onChange={setBothModels} />
        )}
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={independentFinishingModel}
            onChange={(e) => {
              setIndependentFinishingModel(e.target.checked);
              if (!e.target.checked) setBothModels(params.interiorModel);
            }}
          />
          <span>Set interior/exterior finishing models independently</span>
        </label>
        <NumberField label="Outer depth" valueMm={params.outerDepth} onChangeMm={(v) => set("outerDepth", v)} unit={unit} />
        <NumberField label="Inner depth" valueMm={params.innerDepth} onChangeMm={(v) => set("innerDepth", v)} unit={unit} />
        <NumberField label="Bit size" valueMm={params.bitSize} onChangeMm={(v) => set("bitSize", v)} unit={unit} step={0.5} />
        <div className="bit-presets">
          {BIT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={Math.abs(params.bitSize - p.mm) < 1e-3 ? "active" : ""}
              onClick={() => set("bitSize", p.mm)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <NumberField label="Outer width" valueMm={params.outerDiameter} onChangeMm={(v) => set("outerDiameter", v)} unit={unit} />
        {independentAxes && (
          <NumberField
            label="Outer height"
            valueMm={params.outerDiameterY ?? params.outerDiameter}
            onChangeMm={(v) => set("outerDiameterY", v)}
            unit={unit}
          />
        )}
        <NumberField label="Inner width" valueMm={params.innerDiameter} onChangeMm={(v) => set("innerDiameter", v)} unit={unit} />
        {independentAxes && (
          <NumberField
            label="Inner height"
            valueMm={params.innerDiameterY ?? params.innerDiameter}
            onChangeMm={(v) => set("innerDiameterY", v)}
            unit={unit}
          />
        )}
        <Readout
          label="Lip width (nominal, at corners)"
          valueMm={lipWidth}
          unit={unit}
          warnIfBelowMm={params.bitSize}
          warningText={`Thinner than the bit (${mmToDisplay(params.bitSize, unit)}${unitLabel(unit)}) — the lip may be too narrow to cut cleanly, or at all.`}
        />
        <NumberField label="Foot height" valueMm={params.footHeight} onChangeMm={(v) => set("footHeight", v)} unit={unit} />
        <NumberField label="Foot width" valueMm={params.footDiameter} onChangeMm={(v) => set("footDiameter", v)} unit={unit} />
        <Readout
          label="Floor thickness"
          valueMm={floorThickness}
          unit={unit}
          warnIfBelowMm={params.bitSize}
          warningText={
            floorThickness <= 0
              ? "Zero or negative — the interior would cut through the bottom of the bowl. Reduce Inner depth or Foot height, or increase Outer depth."
              : `Thinner than the bit (${mmToDisplay(params.bitSize, unit)}${unitLabel(unit)}) — likely too fragile at the bottom.`
          }
        />
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={params.footRelief ?? true}
            onChange={(e) => set("footRelief", e.target.checked)}
          />
          <span>Include foot relief pocket</span>
        </label>
        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={useZTouchBlock}
            onChange={(e) => {
              setUseZTouchBlock(e.target.checked);
              if (e.target.checked) set("zTouchHeight", params.outerDepth);
            }}
          />
          <span>Using a Z-touch reference block (multi-bit deep cut)</span>
        </label>
        {useZTouchBlock ? (
          <NumberField label="Z-touch height" valueMm={params.zTouchHeight} onChangeMm={(v) => set("zTouchHeight", v)} unit={unit} />
        ) : (
          <p className="hint-note">
            Z-touch height tracks Outer depth automatically ({mmToDisplay(effectiveZTouchHeight, unit)} {unitLabel(unit)}) — check
            the box above only if you're switching cutters partway through a deep bowl.
          </p>
        )}
        <NumberField label="MM cut (width of cut paths)" valueMm={params.mmCut} onChangeMm={(v) => set("mmCut", v)} unit={unit} step={0.1} />
        {params.footRelief !== false && (
          <p className="hint-note">
            A foot relief pocket is included automatically in the roughing file when there's room for it.
          </p>
        )}
        <IntegerField
          label="Max paths per file"
          value={params.maxPathsPerFile ?? 250}
          onChange={(v) => set("maxPathsPerFile", v)}
        />
        <p className="hint-note">
          The original app splits a finishing pass into part2/part3/etc. files once its path list gets long — this
          sets the threshold (an approximation of the original's own, undocumented, rule).
        </p>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={params.includeBoundingBox ?? false}
            onChange={(e) => set("includeBoundingBox", e.target.checked)}
          />
          <span>Include bounding-box guide rectangle (matches the original app)</span>
        </label>

        <label className="field checkbox-field">
          <input
            type="checkbox"
            checked={params.anchor?.enabled ?? false}
            onChange={(e) => set("anchor", { ...(params.anchor ?? DEFAULT_ANCHOR), enabled: e.target.checked })}
          />
          <span>Add a custom anchor marker (Shaper Origin registration point)</span>
        </label>

        {params.anchor?.enabled && (
          <div className="anchor-picker">
            <div className="anchor-grid">
              {ANCHOR_GRID.map((cell) => (
                <button
                  key={cell.position}
                  type="button"
                  title={cell.label}
                  className={params.anchor?.position === cell.position ? "active" : ""}
                  onClick={() => set("anchor", { ...params.anchor!, position: cell.position })}
                >
                  <span className="anchor-dot" />
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`anchor-custom-btn ${params.anchor?.position === "custom" ? "active" : ""}`}
              onClick={() => {
                const current = resolveAnchorPoint(
                  { ...params.anchor!, position: "center" },
                  boundingBox,
                  { x: shapeCenter.cx, y: shapeCenter.cy },
                );
                set("anchor", {
                  ...params.anchor!,
                  position: "custom",
                  customX: params.anchor?.customX ?? current!.x,
                  customY: params.anchor?.customY ?? current!.y,
                });
              }}
            >
              Custom position
            </button>
            {params.anchor?.position === "custom" && (
              <>
                <NumberField
                  label="Anchor X"
                  valueMm={params.anchor.customX ?? 0}
                  onChangeMm={(v) => set("anchor", { ...params.anchor!, customX: v })}
                  unit={unit}
                />
                <NumberField
                  label="Anchor Y"
                  valueMm={params.anchor.customY ?? 0}
                  onChangeMm={(v) => set("anchor", { ...params.anchor!, customY: v })}
                  unit={unit}
                />
                <p className="hint-note">Or drag the red marker in the exterior preview below.</p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="preview">
        <div className="preview-pair">
          {exteriorPreview && (
            <div>
              <h3>Exterior</h3>
              <div className="svg-box-wrap">
                <div className="svg-box" dangerouslySetInnerHTML={{ __html: exteriorPreviewHtml }} />
                {anchorPreviewPoint && params.anchor?.position === "custom" && (
                  <AnchorOverlay
                    box={boundingBox}
                    onDrag={(x, y) => set("anchor", { ...params.anchor!, customX: x, customY: y })}
                  />
                )}
              </div>
            </div>
          )}
          {interiorPreview && (
            <div>
              <h3>Interior</h3>
              <div className="svg-box" dangerouslySetInnerHTML={{ __html: interiorPreviewHtml }} />
            </div>
          )}
        </div>

        <div className="downloads">
          <p>
            {files.length} {files.length === 1 ? "file" : "files"} generated.
          </p>
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
