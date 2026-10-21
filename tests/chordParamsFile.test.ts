import { describe, expect, it } from "vitest";
import { serializeParamsFile } from "../src/params/paramsFile";
import { chordParamsToFields, parseChordParams } from "../src/tools/chord/paramsFile";
import type { ChordParams } from "../src/tools/chord/generate";

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

describe("chord paramsFile round-trip", () => {
  it("restores every field exactly after a serialize/parse round-trip", () => {
    const params: ChordParams = {
      profile: "ogee",
      grooveWidthMm: 40,
      grooveDepthMm: 5,
      lengthMm: 400,
      stepMm: 0.5,
      fluteCount: 3,
      flutePitchMm: 60,
      bitSize: 4,
    };
    const text = serializeParamsFile("Chord", chordParamsToFields(params));
    const restored = parseChordParams(text, DEFAULTS);
    expect(restored).toEqual(params);
  });

  it("falls back to the default profile when the parsed value isn't recognized", () => {
    const restored = parseChordParams("Profile: nonsense\n", DEFAULTS);
    expect(restored.profile).toBe(DEFAULTS.profile);
  });

  it("falls back to defaults field-by-field for missing fields", () => {
    const restored = parseChordParams("Groove Width: 100\n", DEFAULTS);
    expect(restored.grooveWidthMm).toBe(100);
    expect(restored.grooveDepthMm).toBe(DEFAULTS.grooveDepthMm);
  });
});
