import { describe, expect, it } from "vitest";
import { generateBowl } from "../src/tools/bowl/generate";

// Which surface(s) get generated — new-in-this-version option, not in the original
// app (which always produced all four files).
describe("machining mode controls which surfaces are generated", () => {
  const base = {
    sides: 5 as const,
    outerDiameter: 250,
    innerDiameter: 234,
    outerDepth: 60,
    innerDepth: 50,
    footHeight: 2,
    footDiameter: 125,
    zTouchHeight: 60,
    bitSize: 8,
    mmCut: 0.5,
    interiorModel: "circumferential" as const,
    exteriorModel: "circumferential" as const,
  };

  it("two-sided (default) produces all four groups, steps 1-4", () => {
    const names = generateBowl(base).map((f) => f.name);
    expect(names[0]).toBe("Step 1 - Interior Roughing - Pentagon.svg");
    expect(names.some((n) => n.startsWith("Step 3 - Exterior Roughing"))).toBe(true);
    expect(names.some((n) => n.startsWith("Step 4 - Exterior -"))).toBe(true);
  });

  it("interior-only produces only interior files, renumbered 1-2", () => {
    const files = generateBowl({ ...base, machining: "interior-only" });
    expect(files.every((f) => f.kind === "interior-roughing" || f.kind === "interior")).toBe(true);
    expect(files.map((f) => f.name)).toEqual([
      "Step 1 - Interior Roughing - Pentagon.svg",
      "Step 2 - Interior - Pentagon.svg",
      "Step 2 - Interior - Pentagon - part2.svg",
    ]);
  });

  it("exterior-only produces only exterior files, renumbered starting at 1", () => {
    const files = generateBowl({ ...base, machining: "exterior-only" });
    expect(files.every((f) => f.kind === "exterior-roughing" || f.kind === "exterior")).toBe(true);
    expect(files.map((f) => f.name)).toEqual([
      "Step 1 - Exterior Roughing - Pentagon.svg",
      "Step 2 - Exterior - Pentagon.svg",
      "Step 2 - Exterior - Pentagon - part2.svg",
    ]);
  });
});
