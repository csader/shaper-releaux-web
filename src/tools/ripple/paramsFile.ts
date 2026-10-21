import type { ParamField } from "../../params/paramsFile";
import { parseParamsFile } from "../../params/paramsFile";
import type { RippleParams, RippleVariant } from "./generate";

const VARIANTS: RippleVariant[] = ["furrows", "sineContour", "diminishingRings"];

export function rippleParamsToFields(p: RippleParams): ParamField[] {
  return [
    { label: "Variant", value: p.variant },
    { label: "Width", value: p.widthMm },
    { label: "Height", value: p.heightMm },
    { label: "Max Depth", value: p.maxDepthMm },
    { label: "Spacing", value: p.spacingMm },
    { label: "Wavelength", value: p.wavelengthMm },
    { label: "Bit Size", value: p.bitSize },
  ];
}

/** Parses a previously-exported parameters file back into RippleParams, falling
 * back to `defaults` field-by-field for anything missing or unrecognized (an older
 * export, a hand-edited file, etc.) rather than failing the whole import. */
export function parseRippleParams(text: string, defaults: RippleParams): RippleParams {
  const raw = parseParamsFile(text);
  const num = (label: string, fallback: number) => {
    const v = raw[label] !== undefined ? parseFloat(raw[label]) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  const variant = VARIANTS.includes(raw["Variant"] as RippleVariant) ? (raw["Variant"] as RippleVariant) : defaults.variant;
  return {
    variant,
    widthMm: num("Width", defaults.widthMm),
    heightMm: num("Height", defaults.heightMm),
    maxDepthMm: num("Max Depth", defaults.maxDepthMm),
    spacingMm: num("Spacing", defaults.spacingMm),
    wavelengthMm: num("Wavelength", defaults.wavelengthMm),
    bitSize: num("Bit Size", defaults.bitSize),
  };
}
