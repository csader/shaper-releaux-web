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

describe("circular interior profile (generate-level)", () => {
  it("produces finishing rings with monotonically decreasing depth from center to rim", () => {
    const files = generateBowl({ ...baseParams, interiorProfileShape: "circular" });
    const finishing = files.find((f) => f.kind === "interior")!;
    const depths = [...finishing.content.matchAll(/shaper:cutDepth="(-?[\d.]+)mm"/g)].map((m) => parseFloat(m[1]));
    expect(depths.length).toBeGreaterThan(5);
    for (let i = 1; i < depths.length; i++) {
      expect(depths[i]).toBeLessThanOrEqual(depths[i - 1] + 1e-6);
    }
  });

  it("differs from the default elliptical profile's ring geometry", () => {
    const circular = generateBowl({ ...baseParams, interiorProfileShape: "circular" });
    const elliptical = generateBowl({ ...baseParams });
    const circularContent = circular.find((f) => f.kind === "interior")!.content;
    const ellipticalContent = elliptical.find((f) => f.kind === "interior")!.content;
    expect(circularContent).not.toBe(ellipticalContent);
  });

  it("records the chosen shape in the file comments, and omits it when a custom curve is used instead", () => {
    const circular = generateBowl({ ...baseParams, interiorProfileShape: "circular" });
    expect(circular.find((f) => f.kind === "interior")!.content).toContain("Interior Profile Shape = circular");

    const custom = generateBowl({
      ...baseParams,
      customInteriorProfile: { points: [{ r: 0, z: 1 }, { r: 1, z: 0 }] },
    });
    expect(custom.find((f) => f.kind === "interior")!.content).not.toContain("Interior Profile Shape");
  });

  it("the ring closest to the rim actually reaches the real innerDiameter, not half of it", () => {
    // Regression test for a real bug caught during review: circularInteriorProfile
    // initially returned a true radius in its R field, but every other ProfileCurve
    // in this codebase (interiorDiameter/exteriorDiameter) returns the full
    // DIAMETER — swapping it in silently produced bowls at half the intended size.
    const files = generateBowl({ ...baseParams, interiorProfileShape: "circular" });
    const finishing = files.find((f) => f.kind === "interior")!;
    const { cx, cy } = shapeCenterFor(baseParams);
    // Only real absolute coordinates (path start points, arc endpoints) — NOT the
    // "A rx,ry ..." radius pair, which looks like a comma-separated number pair too
    // but isn't a coordinate at all (an earlier version of this test matched it as
    // one, producing a nonsensical "radius" for small rings near the center).
    const coords = [
      ...[...finishing.content.matchAll(/M (-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({ x: +m[1], y: +m[2] })),
      ...[...finishing.content.matchAll(/A [\d.]+,[\d.]+ \d+ \d+ \d+ (-?[\d.]+),(-?[\d.]+)/g)].map((m) => ({
        x: +m[1],
        y: +m[2],
      })),
    ];
    const maxRadius = Math.max(...coords.map((p) => Math.hypot(p.x - cx, p.y - cy)));
    // Should approach innerDiameter/2 (true radius), well above the ~innerDiameter/4
    // the bug would have produced.
    expect(maxRadius).toBeGreaterThan(baseParams.innerDiameter * 0.4);
    expect(maxRadius).toBeLessThanOrEqual(baseParams.innerDiameter / 2 + 1e-3);
  });

  it("leaves the exterior profile's actual geometry unaffected (circular is interior-only)", () => {
    // Compares paths/depths only, not the raw file content — the shared file-header
    // comments legitimately differ (they record which interior shape was used), even
    // though the exterior geometry itself doesn't change at all.
    const extractPaths = (content: string) => [...content.matchAll(/d="([^"]+)"[^>]*shaper:cutDepth="(-?[\d.]+)mm"/g)].map(
      ([, d, depth]) => `${d}|${depth}`,
    );
    const circular = generateBowl({ ...baseParams, interiorProfileShape: "circular" });
    const elliptical = generateBowl({ ...baseParams });
    const circularExterior = extractPaths(circular.find((f) => f.kind === "exterior")!.content);
    const ellipticalExterior = extractPaths(elliptical.find((f) => f.kind === "exterior")!.content);
    expect(circularExterior).toEqual(ellipticalExterior);
  });
});
