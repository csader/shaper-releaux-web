import type { ParamField } from "../../params/paramsFile";
import { parseParamsFile } from "../../params/paramsFile";
import type { ChordProfile } from "../../geometry/chord";
import type { ChordParams } from "./generate";

const PROFILES: ChordProfile[] = ["concave", "convex", "ogee"];

export function chordParamsToFields(p: ChordParams): ParamField[] {
  return [
    { label: "Profile", value: p.profile },
    { label: "Groove Width", value: p.grooveWidthMm },
    { label: "Groove Depth", value: p.grooveDepthMm },
    { label: "Length", value: p.lengthMm },
    { label: "Step", value: p.stepMm },
    { label: "Flute Count", value: p.fluteCount },
    { label: "Flute Pitch", value: p.flutePitchMm },
    { label: "Bit Size", value: p.bitSize },
  ];
}

export function parseChordParams(text: string, defaults: ChordParams): ChordParams {
  const raw = parseParamsFile(text);
  const num = (label: string, fallback: number) => {
    const v = raw[label] !== undefined ? parseFloat(raw[label]) : NaN;
    return Number.isFinite(v) ? v : fallback;
  };
  const profile = PROFILES.includes(raw["Profile"] as ChordProfile) ? (raw["Profile"] as ChordProfile) : defaults.profile;
  return {
    profile,
    grooveWidthMm: num("Groove Width", defaults.grooveWidthMm),
    grooveDepthMm: num("Groove Depth", defaults.grooveDepthMm),
    lengthMm: num("Length", defaults.lengthMm),
    stepMm: num("Step", defaults.stepMm),
    fluteCount: num("Flute Count", defaults.fluteCount),
    flutePitchMm: num("Flute Pitch", defaults.flutePitchMm),
    bitSize: num("Bit Size", defaults.bitSize),
  };
}
