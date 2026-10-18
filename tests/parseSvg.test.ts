import { describe, expect, it } from "vitest";
import { extractDeclaredSizeMm } from "../src/import/parseSvg";

// Only extractDeclaredSizeMm is tested here — everything else in parseSvg.ts is
// DOM-dependent (SVGPathElement, getCTM, getPointAtLength) and verified manually in
// a real browser instead (see plan notes). This function is pure string parsing.
describe("extractDeclaredSizeMm", () => {
  it("reads an explicit mm size (the real file that prompted this)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="127mm" height="76.19999999999999mm" viewBox="-63.5 -38.1 127 76.2"></svg>`;
    const size = extractDeclaredSizeMm(svg);
    expect(size).not.toBeNull();
    expect(size!.widthMm).toBeCloseTo(127, 6);
    expect(size!.heightMm).toBeCloseTo(76.2, 6);
  });

  it("converts inches to mm", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="5in" height="3in"></svg>`;
    const size = extractDeclaredSizeMm(svg);
    expect(size!.widthMm).toBeCloseTo(127, 6);
    expect(size!.heightMm).toBeCloseTo(76.2, 6);
  });

  it("converts cm to mm", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10cm" height="5cm"></svg>`;
    const size = extractDeclaredSizeMm(svg);
    expect(size!.widthMm).toBeCloseTo(100, 6);
    expect(size!.heightMm).toBeCloseTo(50, 6);
  });

  it("returns null for bare unitless numbers (not reliably physical)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080"></svg>`;
    expect(extractDeclaredSizeMm(svg)).toBeNull();
  });

  it("returns null for px units (screen pixels, not reliably physical)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920px" height="1080px"></svg>`;
    expect(extractDeclaredSizeMm(svg)).toBeNull();
  });

  it("returns null when width/height are absent entirely", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080"></svg>`;
    expect(extractDeclaredSizeMm(svg)).toBeNull();
  });

  it("returns null for percentage units", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"></svg>`;
    expect(extractDeclaredSizeMm(svg)).toBeNull();
  });
});
