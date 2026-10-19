import { describe, expect, it } from "vitest";
import { evaluateDimensionExpr } from "../src/expr";

describe("evaluateDimensionExpr", () => {
  it("evaluates a plain number in the field's current unit", () => {
    expect(evaluateDimensionExpr("15", "mm")).toBeCloseTo(15, 6);
    expect(evaluateDimensionExpr("15", "in")).toBeCloseTo(15 * 25.4, 6);
  });

  it("an explicit suffix overrides the field's current unit", () => {
    expect(evaluateDimensionExpr("5in", "mm")).toBeCloseTo(5 * 25.4, 6);
    expect(evaluateDimensionExpr("127mm", "in")).toBeCloseTo(127, 6);
  });

  it("supports + - * / with standard precedence", () => {
    expect(evaluateDimensionExpr("2 + 3 * 4", "mm")).toBeCloseTo(14, 6);
    expect(evaluateDimensionExpr("(2 + 3) * 4", "mm")).toBeCloseTo(20, 6);
    expect(evaluateDimensionExpr("10 - 2 - 3", "mm")).toBeCloseTo(5, 6);
    expect(evaluateDimensionExpr("10 / 2 / 5", "mm")).toBeCloseTo(1, 6);
  });

  it("supports unary minus, including nested", () => {
    expect(evaluateDimensionExpr("-5", "mm")).toBeCloseTo(-5, 6);
    expect(evaluateDimensionExpr("3 - -2", "mm")).toBeCloseTo(5, 6);
    expect(evaluateDimensionExpr("-(2 + 3)", "mm")).toBeCloseTo(-5, 6);
  });

  it("the exact motivating example: 15mm + (3/4*4)in", () => {
    // 3/4*4 = 3, interpreted as 3in = 76.2mm; 15mm + 76.2mm = 91.2mm.
    expect(evaluateDimensionExpr("15mm + (3/4*4)in", "mm")).toBeCloseTo(91.2, 6);
    // Field unit shouldn't matter here — every term has its own explicit suffix.
    expect(evaluateDimensionExpr("15mm + (3/4*4)in", "in")).toBeCloseTo(91.2, 6);
  });

  it("a parenthesized group's own suffix applies once, not per inner literal", () => {
    // If each of 3/4/4 individually picked up an ambient "in" before combining, this
    // would NOT equal 3in (76.2mm) — it would double-convert. Verify both ambient
    // unit choices still land on exactly 76.2mm.
    expect(evaluateDimensionExpr("(3/4*4)in", "mm")).toBeCloseTo(76.2, 6);
    expect(evaluateDimensionExpr("(3/4*4)in", "in")).toBeCloseTo(76.2, 6);
  });

  it("a group with no suffix of its own uses the ambient field unit, like a bare number", () => {
    expect(evaluateDimensionExpr("(15 + 3)", "mm")).toBeCloseTo(18, 6);
    expect(evaluateDimensionExpr("(15 + 3)", "in")).toBeCloseTo(18 * 25.4, 6);
  });

  it("mixes a suffixed and an unsuffixed term — the unsuffixed one takes the field unit", () => {
    expect(evaluateDimensionExpr("15 + 3in", "mm")).toBeCloseTo(15 + 76.2, 6);
    expect(evaluateDimensionExpr("15 + 3in", "in")).toBeCloseTo(15 * 25.4 + 76.2, 6);
  });

  it("nested unsuffixed groups inherit through to the nearest enclosing suffix", () => {
    // (1 + (2*3)) = 7, as inches = 177.8mm.
    expect(evaluateDimensionExpr("(1 + (2*3))in", "mm")).toBeCloseTo(177.8, 6);
  });

  it("supports cm, m, and ft suffixes in addition to mm/in", () => {
    expect(evaluateDimensionExpr("1cm", "mm")).toBeCloseTo(10, 6);
    expect(evaluateDimensionExpr("1m", "mm")).toBeCloseTo(1000, 6);
    expect(evaluateDimensionExpr("1ft", "mm")).toBeCloseTo(304.8, 6);
    expect(evaluateDimensionExpr("2ft + 30cm", "mm")).toBeCloseTo(609.6 + 300, 6);
  });

  it("is case-insensitive and tolerant of whitespace around suffixes", () => {
    expect(evaluateDimensionExpr("5IN", "mm")).toBeCloseTo(127, 6);
    expect(evaluateDimensionExpr("5 in", "mm")).toBeCloseTo(127, 6);
    expect(evaluateDimensionExpr(" 5   +   3 ", "mm")).toBeCloseTo(8, 6);
  });

  it("returns null for empty, incomplete, or malformed input", () => {
    expect(evaluateDimensionExpr("", "mm")).toBeNull();
    expect(evaluateDimensionExpr("   ", "mm")).toBeNull();
    expect(evaluateDimensionExpr("15 +", "mm")).toBeNull();
    expect(evaluateDimensionExpr("(15 + 3", "mm")).toBeNull();
    expect(evaluateDimensionExpr("15mmin", "mm")).toBeNull();
    expect(evaluateDimensionExpr("abc", "mm")).toBeNull();
    expect(evaluateDimensionExpr("15 3", "mm")).toBeNull();
  });

  it("returns null for division by zero rather than Infinity/NaN", () => {
    expect(evaluateDimensionExpr("5 / 0", "mm")).toBeNull();
  });
});
