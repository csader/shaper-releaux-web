import { describe, expect, it } from "vitest";
import { generateBowl } from "../src/tools/bowl/generate";

// Shaper Origin may treat a literal "0mm" cutDepth as unset and fall back to
// whatever depth is currently dialed into the tool, rather than actually cutting to
// the surface — observed on a real job: the interior rim ring (always exactly 0mm
// when not using a Z-touch reference block) got cut at the previous, deeper ring's
// depth instead of 0, leaving an over-deep band right at the edge.
describe("zero-depth nudge", () => {
  it("interior rim ring never emits a literal 0mm cutDepth", () => {
    const files = generateBowl({
      sides: 1,
      outerDiameter: 135.382,
      innerDiameter: 135.382,
      outerDepth: 15.875,
      innerDepth: 12.7,
      footHeight: 2,
      footDiameter: 125,
      zTouchHeight: 15.875,
      bitSize: 6.35,
      mmCut: 0.5,
      interiorModel: "circumferential",
      exteriorModel: "circumferential",
      machining: "interior-only",
    });
    const finishing = files.filter((f) => f.kind === "interior");
    expect(finishing.length).toBeGreaterThan(0);

    for (const f of finishing) {
      expect(f.content).not.toMatch(/shaper:cutDepth="0mm"/);
      expect(f.content).not.toMatch(/shaper:cutDepth="0\.0*mm"/);
    }
    // Negative, not positive — more-negative means deeper in this encoding, so the
    // nudge must stay on the "still cutting" side, not the "above the surface" side.
    const combined = finishing.map((f) => f.content).join("\n");
    expect(combined).toMatch(/shaper:cutDepth="-0\.001mm"/);
  });
});
