import type { ParamField } from "../../params/paramsFile";
import { parseParamsFile } from "../../params/paramsFile";
import type { BowlParams } from "./generate";
import type { SteppingModel } from "../../geometry/profile";
import type { AnchorPosition } from "../../svg/anchor";

const MODELS: SteppingModel[] = ["radial", "circumferential", "hybrid", "horizontal"];
const MACHINING_MODES: NonNullable<BowlParams["machining"]>[] = ["two-sided", "interior-only", "exterior-only"];
const ANCHOR_POSITIONS: AnchorPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "custom",
];

/** Only the plain scalar fields + anchor sub-fields — a custom imported shape outline
 * or a hand-drawn custom profile curve can't round-trip through a "key: value" text
 * file, so those are deliberately left out and flagged separately (see
 * parseBowlParams's warnings) rather than silently guessed at. */
export function bowlParamsToFields(p: BowlParams): ParamField[] {
  const fields: ParamField[] = [
    { label: "Sides", value: p.sides === "custom" ? "custom (re-upload the original shape file separately)" : p.sides },
    { label: "Outer Diameter", value: p.outerDiameter },
    { label: "Inner Diameter", value: p.innerDiameter },
    { label: "Outer Depth", value: p.outerDepth },
    { label: "Inner Depth", value: p.innerDepth },
    { label: "Foot Height", value: p.footHeight },
    { label: "Foot Diameter", value: p.footDiameter },
    { label: "Z Touch Height", value: p.zTouchHeight },
    { label: "Bit Size", value: p.bitSize },
    { label: "MM Cut", value: p.mmCut },
    { label: "Interior Model", value: p.interiorModel },
    { label: "Exterior Model", value: p.exteriorModel },
    { label: "Foot Relief", value: p.footRelief ?? true },
    { label: "Include Bounding Box", value: p.includeBoundingBox ?? false },
    { label: "Max Paths Per File", value: p.maxPathsPerFile ?? 250 },
    { label: "Machining", value: p.machining ?? "two-sided" },
  ];
  if (p.outerDiameterY !== undefined) fields.push({ label: "Outer Diameter Y", value: p.outerDiameterY });
  if (p.innerDiameterY !== undefined) fields.push({ label: "Inner Diameter Y", value: p.innerDiameterY });
  if (p.anchor) {
    fields.push(
      { label: "Anchor Enabled", value: p.anchor.enabled },
      { label: "Anchor Position", value: p.anchor.position },
    );
    if (p.anchor.customX !== undefined) fields.push({ label: "Anchor Custom X", value: p.anchor.customX });
    if (p.anchor.customY !== undefined) fields.push({ label: "Anchor Custom Y", value: p.anchor.customY });
  }
  if (p.customInteriorProfile) {
    fields.push({ label: "Custom Interior Profile", value: "yes (not restored by this file — redraw it separately)" });
  }
  if (p.customExteriorProfile) {
    fields.push({ label: "Custom Exterior Profile", value: "yes (not restored by this file — redraw it separately)" });
  }
  return fields;
}

export interface ParsedBowlParams {
  params: BowlParams;
  /** Set when the exported file used a custom shape and/or custom profile curve —
   * those aren't recorded in this file, so the caller should surface this to the
   * user rather than silently restoring an incomplete job. */
  warnings: string[];
}

export function parseBowlParams(text: string, defaults: BowlParams): ParsedBowlParams {
  const raw = parseParamsFile(text);
  const warnings: string[] = [];
  const num = (label: string, fallback: number) => {
    const v = raw[label] !== undefined ? parseFloat(raw[label]) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  const numOrUndefined = (label: string): number | undefined => {
    if (raw[label] === undefined) return undefined;
    const v = parseFloat(raw[label]);
    return Number.isFinite(v) ? v : undefined;
  };
  const bool = (label: string, fallback: boolean) => (raw[label] === undefined ? fallback : raw[label] === "true");

  let sides = defaults.sides;
  const rawSides = raw["Sides"];
  if (rawSides !== undefined) {
    if (rawSides.startsWith("custom")) {
      warnings.push("This file was exported with a custom shape — re-upload the original shape SVG separately.");
    } else {
      const n = parseInt(rawSides, 10);
      if (Number.isFinite(n)) sides = n as BowlParams["sides"];
    }
  }

  if (raw["Custom Interior Profile"] !== undefined) {
    warnings.push("This file was exported with a hand-drawn custom interior profile — redraw it separately.");
  }
  if (raw["Custom Exterior Profile"] !== undefined) {
    warnings.push("This file was exported with a hand-drawn custom exterior profile — redraw it separately.");
  }

  const interiorModel = MODELS.includes(raw["Interior Model"] as SteppingModel)
    ? (raw["Interior Model"] as SteppingModel)
    : defaults.interiorModel;
  const exteriorModel = MODELS.includes(raw["Exterior Model"] as SteppingModel)
    ? (raw["Exterior Model"] as SteppingModel)
    : defaults.exteriorModel;
  const rawMachining = raw["Machining"];
  const machining: NonNullable<BowlParams["machining"]> = MACHINING_MODES.includes(rawMachining as never)
    ? (rawMachining as NonNullable<BowlParams["machining"]>)
    : (defaults.machining ?? "two-sided");

  const params: BowlParams = {
    ...defaults,
    sides,
    outerDiameter: num("Outer Diameter", defaults.outerDiameter),
    outerDiameterY: numOrUndefined("Outer Diameter Y"),
    innerDiameter: num("Inner Diameter", defaults.innerDiameter),
    innerDiameterY: numOrUndefined("Inner Diameter Y"),
    outerDepth: num("Outer Depth", defaults.outerDepth),
    innerDepth: num("Inner Depth", defaults.innerDepth),
    footHeight: num("Foot Height", defaults.footHeight),
    footDiameter: num("Foot Diameter", defaults.footDiameter),
    zTouchHeight: num("Z Touch Height", defaults.zTouchHeight),
    bitSize: num("Bit Size", defaults.bitSize),
    mmCut: num("MM Cut", defaults.mmCut),
    interiorModel,
    exteriorModel,
    footRelief: bool("Foot Relief", defaults.footRelief ?? true),
    includeBoundingBox: bool("Include Bounding Box", defaults.includeBoundingBox ?? false),
    maxPathsPerFile: Math.round(num("Max Paths Per File", defaults.maxPathsPerFile ?? 250)),
    machining,
    // Custom shape/profile aren't restorable from this file — never carried over,
    // even if `defaults` happened to have one from the current session.
    customShape: undefined,
    customShapeName: undefined,
    customInteriorProfile: undefined,
    customExteriorProfile: undefined,
  };

  if (raw["Anchor Enabled"] !== undefined || raw["Anchor Position"] !== undefined) {
    const position = ANCHOR_POSITIONS.includes(raw["Anchor Position"] as AnchorPosition)
      ? (raw["Anchor Position"] as AnchorPosition)
      : (defaults.anchor?.position ?? "center");
    params.anchor = {
      enabled: bool("Anchor Enabled", defaults.anchor?.enabled ?? true),
      position,
      customX: numOrUndefined("Anchor Custom X"),
      customY: numOrUndefined("Anchor Custom Y"),
    };
  }

  return { params, warnings };
}
