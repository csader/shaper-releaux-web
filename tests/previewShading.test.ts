import { describe, expect, it } from "vitest";
import { shadeForDepth } from "../src/svg/previewShading";

// Only shadeForDepth is tested here — the rest of previewShading.ts is DOM-dependent
// (DOMParser, XMLSerializer) and not available under vitest's default Node
// environment, same situation as import/parseSvg.ts's DOM-heavy parsing.
describe("shadeForDepth", () => {
  it("shallowest depth gets the light shade, deepest gets the dark shade", () => {
    expect(shadeForDepth(0, 0, 50)).toBe(235);
    expect(shadeForDepth(50, 0, 50)).toBe(85);
  });

  it("interpolates linearly in between", () => {
    expect(shadeForDepth(25, 0, 50)).toBe(160); // exact midpoint of 235 and 85
  });

  it("depth and shade move in opposite directions (deeper = darker), not tied to array position", () => {
    // A ring with a smaller index but a deeper cutDepth must still come out darker —
    // this is the whole point of the fix: shade follows the real depth value, not
    // where the ring happens to sit in the generated list.
    const shallow = shadeForDepth(5, 0, 50);
    const deep = shadeForDepth(45, 0, 50);
    expect(deep).toBeLessThan(shallow);
  });

  it("handles a degenerate (all-equal) depth range without dividing by zero", () => {
    expect(shadeForDepth(10, 10, 10)).toBe(235);
    expect(Number.isFinite(shadeForDepth(10, 10, 10))).toBe(true);
  });

  it("works correctly with negative depth values (Z-touch-block multi-bit encoding)", () => {
    // Real sample files encode negative cutDepth values — confirmed earlier in this
    // project against ground truth (Pear wood 5 sides' roughing file).
    expect(shadeForDepth(-8, -8, 26)).toBe(235); // shallowest (min) -> light
    expect(shadeForDepth(26, -8, 26)).toBe(85); // deepest (max) -> dark
  });
});
