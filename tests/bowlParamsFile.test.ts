import { describe, expect, it } from "vitest";
import { serializeParamsFile } from "../src/params/paramsFile";
import { bowlParamsToFields, parseBowlParams } from "../src/tools/bowl/paramsFile";
import type { BowlParams } from "../src/tools/bowl/generate";

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
  anchor: { enabled: true, position: "center" },
};

describe("bowl paramsFile round-trip", () => {
  it("restores every plain scalar field exactly after a serialize/parse round-trip", () => {
    const params: BowlParams = {
      sides: 6,
      outerDiameter: 200,
      innerDiameter: 180,
      outerDepth: 40,
      innerDepth: 35,
      footHeight: 3,
      footDiameter: 100,
      zTouchHeight: 40,
      bitSize: 6,
      mmCut: 0.3,
      interiorModel: "horizontal",
      exteriorModel: "hybrid",
      footRelief: false,
      includeBoundingBox: true,
      maxPathsPerFile: 200,
      machining: "interior-only",
      anchor: { enabled: true, position: "bottom-right" },
      interiorProfileShape: "elliptical",
      flatBottomDiameter: 0,
    };
    const text = serializeParamsFile("Bowl", bowlParamsToFields(params));
    const { params: restored, warnings } = parseBowlParams(text, DEFAULTS);
    expect(restored).toEqual(params);
    expect(warnings).toEqual([]);
  });

  it("restores independent-axis (ellipse/rectangle) Y dimensions when present", () => {
    const params: BowlParams = { ...DEFAULTS, sides: 1, outerDiameterY: 180, innerDiameterY: 160 };
    const text = serializeParamsFile("Bowl", bowlParamsToFields(params));
    const { params: restored } = parseBowlParams(text, DEFAULTS);
    expect(restored.outerDiameterY).toBe(180);
    expect(restored.innerDiameterY).toBe(160);
  });

  it("restores a circular interior profile with a flat bottom diameter", () => {
    const params: BowlParams = { ...DEFAULTS, interiorProfileShape: "circular", flatBottomDiameter: 40 };
    const text = serializeParamsFile("Bowl", bowlParamsToFields(params));
    const { params: restored } = parseBowlParams(text, DEFAULTS);
    expect(restored.interiorProfileShape).toBe("circular");
    expect(restored.flatBottomDiameter).toBe(40);
  });

  it("restores custom anchor X/Y coordinates", () => {
    const params: BowlParams = { ...DEFAULTS, anchor: { enabled: true, position: "custom", customX: 12.5, customY: 34.5 } };
    const text = serializeParamsFile("Bowl", bowlParamsToFields(params));
    const { params: restored } = parseBowlParams(text, DEFAULTS);
    expect(restored.anchor).toEqual({ enabled: true, position: "custom", customX: 12.5, customY: 34.5 });
  });

  it("warns and refuses to fabricate a shape when the export used a custom shape", () => {
    const params: BowlParams = { ...DEFAULTS, sides: "custom", customShapeName: "MyShape" };
    const text = serializeParamsFile("Bowl", bowlParamsToFields(params));
    const { params: restored, warnings } = parseBowlParams(text, DEFAULTS);
    expect(restored.sides).toBe(DEFAULTS.sides); // falls back rather than guessing
    expect(restored.customShape).toBeUndefined();
    expect(warnings.some((w) => w.includes("custom shape"))).toBe(true);
  });

  it("warns when the export used a custom profile curve, and never carries one over from `defaults`", () => {
    const withCustomProfile: BowlParams = { ...DEFAULTS, customInteriorProfile: { points: [{ r: 0, z: 0 }, { r: 1, z: 1 }] } };
    const text = serializeParamsFile("Bowl", bowlParamsToFields(withCustomProfile));
    // Even if the current session's `defaults` happens to carry a custom profile, the
    // restored params must not inherit it silently.
    const { params: restored, warnings } = parseBowlParams(text, withCustomProfile);
    expect(restored.customInteriorProfile).toBeUndefined();
    expect(warnings.some((w) => w.includes("custom interior profile"))).toBe(true);
  });

  it("falls back to defaults field-by-field for missing fields", () => {
    const { params: restored } = parseBowlParams("Outer Diameter: 300\n", DEFAULTS);
    expect(restored.outerDiameter).toBe(300);
    expect(restored.innerDiameter).toBe(DEFAULTS.innerDiameter);
  });
});
