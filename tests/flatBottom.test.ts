import { describe, expect, it } from "vitest";
import { generateBowl, shapeCenterFor } from "../src/tools/bowl/generate";

const baseParams = {
  sides: 1 as const,
  outerDiameter: 200,
  innerDiameter: 180,
  outerDepth: 60,
  innerDepth: 50,
  footHeight: 2,
  footDiameter: 100,
  zTouchHeight: 60,
  bitSize: 8,
  mmCut: 1,
  interiorModel: "circumferential" as const,
  exteriorModel: "circumferential" as const,
};

function realAbsoluteCoords(content: string) {
  return [
    ...[...content.matchAll(/M (-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] })),
    ...[...content.matchAll(/A [\d.]+,[\d.]+ \d+ \d+ \d+ (-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
      x: +m[1],
      y: +m[2],
    })),
  ];
}

describe("flat bottom (interior)", () => {
  it("leaves default behavior completely unchanged when unset (0 shift)", () => {
    const withField = generateBowl({ ...baseParams, flatBottomDiameter: 0 });
    const without = generateBowl(baseParams);
    const a = withField.find((f) => f.kind === "interior")!.content;
    const b = without.find((f) => f.kind === "interior")!.content;
    expect(a).toBe(b);
  });

  it("the finishing ring at theta=0 lands at the flat bottom's own diameter, at the full depth", () => {
    // generateBowl doesn't expose theta=0 directly in the public API, so this reaches
    // through the same curve math generate.ts itself builds, for both profile shapes.
    for (const interiorProfileShape of ["elliptical", "circular"] as const) {
      const flatBottomDiameter = 40;
      const files = generateBowl({ ...baseParams, interiorProfileShape, flatBottomDiameter });
      const finishing = files.find((f) => f.kind === "interior")!;
      const coords = realAbsoluteCoords(finishing.content);
      const { cx, cy } = shapeCenterFor(baseParams);
      const minRadius = Math.min(...coords.map((p) => Math.hypot(p.x - cx, p.y - cy)));
      // The innermost finishing ring should sit right at the flat disc's own radius,
      // not tapering toward 0 like the no-flat-bottom case would.
      expect(minRadius).toBeCloseTo(flatBottomDiameter / 2, 0);
      const depths = [...finishing.content.matchAll(/shaper:cutDepth="(-?[\d.]+)mm"/g)].map((m) => parseFloat(m[1]));
      expect(Math.max(...depths)).toBeCloseTo(baseParams.innerDepth, 1);
    }
  });

  it("the outermost finishing ring still reaches the full innerDiameter at the rim", () => {
    for (const interiorProfileShape of ["elliptical", "circular"] as const) {
      const flatBottomDiameter = 40;
      const files = generateBowl({ ...baseParams, interiorProfileShape, flatBottomDiameter });
      const finishing = files.find((f) => f.kind === "interior")!;
      const coords = realAbsoluteCoords(finishing.content);
      const { cx, cy } = shapeCenterFor(baseParams);
      const maxRadius = Math.max(...coords.map((p) => Math.hypot(p.x - cx, p.y - cy)));
      expect(maxRadius).toBeCloseTo(baseParams.innerDiameter / 2, 0);
    }
  });

  it("the deepest roughing pocket lands near the flat disc's own diameter, not a near-zero point", () => {
    const flatBottomDiameter = 40;
    const flat = generateBowl({ ...baseParams, flatBottomDiameter });
    const pointed = generateBowl(baseParams);
    const flatRoughing = flat.find((f) => f.kind === "interior-roughing")!;
    const pointedRoughing = pointed.find((f) => f.kind === "interior-roughing")!;
    const { cx, cy } = shapeCenterFor(baseParams);
    const smallestRingRadius = (content: string) => {
      const coords = realAbsoluteCoords(content);
      return Math.min(...coords.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    };
    expect(smallestRingRadius(flatRoughing.content)).toBeGreaterThan(smallestRingRadius(pointedRoughing.content) + 10);
  });

  it("is ignored entirely when a custom interior profile curve is used", () => {
    const custom = generateBowl({
      ...baseParams,
      flatBottomDiameter: 40,
      customInteriorProfile: { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] },
    });
    const customNoFlat = generateBowl({
      ...baseParams,
      customInteriorProfile: { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] },
    });
    expect(custom.find((f) => f.kind === "interior")!.content).toBe(
      customNoFlat.find((f) => f.kind === "interior")!.content,
    );
  });

  it("leaves the exterior profile's geometry unaffected (flat bottom is interior-only)", () => {
    const flat = generateBowl({ ...baseParams, flatBottomDiameter: 40 });
    const pointed = generateBowl(baseParams);
    const extractPaths = (content: string) =>
      [...content.matchAll(/d="([^"]+)"[^>]*shaper:cutDepth="(-?[\d.]+)mm"/g)].map(([, d, depth]) => `${d}|${depth}`);
    expect(extractPaths(flat.find((f) => f.kind === "exterior")!.content)).toEqual(
      extractPaths(pointed.find((f) => f.kind === "exterior")!.content),
    );
  });

  it("records the flat bottom diameter in the file comments only when set", () => {
    const flat = generateBowl({ ...baseParams, flatBottomDiameter: 40 });
    expect(flat.find((f) => f.kind === "interior")!.content).toContain("Flat Bottom Diameter = 40");
    const pointed = generateBowl(baseParams);
    expect(pointed.find((f) => f.kind === "interior")!.content).not.toContain("Flat Bottom Diameter");
  });
});
