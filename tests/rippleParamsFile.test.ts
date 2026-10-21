import { describe, expect, it } from "vitest";
import { serializeParamsFile } from "../src/params/paramsFile";
import { parseRippleParams, rippleParamsToFields } from "../src/tools/ripple/paramsFile";
import type { RippleParams } from "../src/tools/ripple/generate";

const DEFAULTS: RippleParams = {
  variant: "diminishingRings",
  widthMm: 150,
  heightMm: 150,
  maxDepthMm: 6,
  spacingMm: 1,
  wavelengthMm: 20,
  bitSize: 8,
};

describe("ripple paramsFile round-trip", () => {
  it("restores every field exactly after a serialize/parse round-trip", () => {
    const params: RippleParams = {
      variant: "furrows",
      widthMm: 200,
      heightMm: 100,
      maxDepthMm: 4,
      spacingMm: 2,
      wavelengthMm: 15,
      bitSize: 6,
    };
    const text = serializeParamsFile("Ripple", rippleParamsToFields(params));
    const restored = parseRippleParams(text, DEFAULTS);
    expect(restored).toEqual(params);
  });

  it("falls back to defaults field-by-field when the file is missing/garbled fields", () => {
    const restored = parseRippleParams("Width: 200\n", DEFAULTS);
    expect(restored.widthMm).toBe(200);
    expect(restored.heightMm).toBe(DEFAULTS.heightMm);
    expect(restored.variant).toBe(DEFAULTS.variant);
  });

  it("falls back to the default variant when the parsed value isn't a recognized one", () => {
    const restored = parseRippleParams("Variant: nonsense\n", DEFAULTS);
    expect(restored.variant).toBe(DEFAULTS.variant);
  });
});
