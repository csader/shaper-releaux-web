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

  describe("regression: a unit suffix scopes over the whole term, not just the adjacent factor", () => {
    it("a bare fraction before a suffix means a fraction OF that unit (the reported bug)", () => {
      // 3/4in must mean 0.75in (19.05mm) — NOT 3 / (4 "in") = 3/101.6 = 0.0295mm,
      // which is what the first implementation of this file actually did.
      expect(evaluateDimensionExpr("3/4in", "mm")).toBeCloseTo(19.05, 6);
      expect(evaluateDimensionExpr("3/4in", "in")).toBeCloseTo(19.05, 6);
    });

    it("a suffix right after the first factor still scopes correctly when the chain continues", () => {
      expect(evaluateDimensionExpr("4in/2", "mm")).toBeCloseTo((4 * 25.4) / 2, 6);
      expect(evaluateDimensionExpr("10/4in/2", "mm")).toBeCloseTo(((10 / 4) * 25.4) / 2, 6);
    });

    it("multiplication: suffix position within a pure */ chain doesn't change the result", () => {
      expect(evaluateDimensionExpr("2*3in", "mm")).toBeCloseTo(2 * 3 * 25.4, 6);
      expect(evaluateDimensionExpr("2in*3", "mm")).toBeCloseTo(2 * 25.4 * 3, 6);
    });

    it("a mixed suffixed/unsuffixed sum: the unsuffixed term still independently defers to the field unit", () => {
      expect(evaluateDimensionExpr("15 + 3in", "in")).toBeCloseTo(15 * 25.4 + 3 * 25.4, 6);
    });
  });

  describe("regression: a fully unsuffixed expression converts once per term, not once per leaf", () => {
    it("addition distributes correctly either way, but multiplication must not be converted per-leaf", () => {
      // Converting every bare leaf independently before combining is only safe for +
      // and - (which distribute over a scalar factor); for * and /, converting each
      // leaf independently compounds the conversion factor once per leaf instead of
      // applying it once to the term — e.g. under "in", a naive per-leaf conversion
      // of "3*4" would give (3·25.4)·(4·25.4), not (3·4)·25.4.
      expect(evaluateDimensionExpr("2 + 3 * 4", "in")).toBeCloseTo((2 + 3 * 4) * 25.4, 6);
      expect(evaluateDimensionExpr("(2 + 3) * 4", "in")).toBeCloseTo((2 + 3) * 4 * 25.4, 6);
      expect(evaluateDimensionExpr("10 - 2 - 3", "in")).toBeCloseTo((10 - 2 - 3) * 25.4, 6);
      expect(evaluateDimensionExpr("10 / 2 / 5", "in")).toBeCloseTo((10 / 2 / 5) * 25.4, 6);
    });

    it("unary minus over an additive group still converts once, correctly", () => {
      expect(evaluateDimensionExpr("-(2 + 3)", "in")).toBeCloseTo(-5 * 25.4, 6);
    });
  });
});
