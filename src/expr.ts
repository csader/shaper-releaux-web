// Lets dimension fields accept arithmetic expressions with inline unit suffixes, e.g.
// "15mm + (3/4*4)in" or "2ft + 30cm", and evaluates them to a single mm value.
//
// Unit resolution rule: a bare number or parenthesized group with no suffix of its
// own is interpreted in `fieldUnit` (the field's current mm/in toggle) — UNLESS it
// sits inside a parenthesized group that itself carries an explicit suffix, in which
// case everything inside that group is treated as a plain (unitless) number, and the
// group's own trailing suffix is applied exactly once to the combined result. This
// two-pass (parse, then evaluate top-down threading an "ambient unit") design is what
// keeps "(3/4*4)in" from double-converting: without it, each bare 3/4/4 would pick up
// the ambient unit AND the group's own "in" suffix would convert again on top.
//
// `fieldUnit` (the ambient/toggle unit) is only ever "mm" or "in" — that's all the
// app's unit toggle offers — but an explicit per-atom suffix can be any of the length
// units below, since those are just string literals typed by the user, not tied to
// the toggle.

import type { Unit } from "./units";

type LengthUnit = Unit | "cm" | "m" | "ft";

const UNIT_TO_MM: Record<LengthUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

type Token =
  | { type: "num"; value: number }
  | { type: "unit"; value: LengthUnit }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "lparen" }
  | { type: "rparen" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen" });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen" });
      i++;
      continue;
    }
    if (c === "+" || c === "-" || c === "*" || c === "/") {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    const rest = input.slice(i);
    const numMatch = /^(\d+\.\d*|\.\d+|\d+)/.exec(rest);
    if (numMatch) {
      tokens.push({ type: "num", value: parseFloat(numMatch[0]) });
      i += numMatch[0].length;
      continue;
    }
    // Longer/more-specific alternatives first ("mm" before "m") — regex alternation
    // takes the first match, not the longest, so order determines correctness here.
    const unitMatch = /^(mm|cm|ft|in|m)/i.exec(rest);
    if (unitMatch) {
      tokens.push({ type: "unit", value: unitMatch[0].toLowerCase() as LengthUnit });
      i += unitMatch[0].length;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return tokens;
}

type Node =
  | { kind: "num"; value: number; suffix: LengthUnit | null }
  | { kind: "group"; inner: Node; suffix: LengthUnit | null }
  | { kind: "binop"; op: "+" | "-" | "*" | "/"; left: Node; right: Node }
  | { kind: "neg"; node: Node };

class Parser {
  private pos = 0;
  private tokens: Token[];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): Node {
    const node = this.parseExpr();
    if (this.pos !== this.tokens.length) throw new Error("Unexpected trailing input");
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const t = this.tokens[this.pos];
    if (!t) throw new Error("Unexpected end of expression");
    this.pos++;
    return t;
  }

  private parseExpr(): Node {
    let node = this.parseTerm();
    for (;;) {
      const t = this.peek();
      if (t?.type !== "op" || (t.value !== "+" && t.value !== "-")) break;
      this.consume();
      node = { kind: "binop", op: t.value, left: node, right: this.parseTerm() };
    }
    return node;
  }

  private parseTerm(): Node {
    let node = this.parseUnary();
    for (;;) {
      const t = this.peek();
      if (t?.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      this.consume();
      node = { kind: "binop", op: t.value, left: node, right: this.parseUnary() };
    }
    return node;
  }

  private parseUnary(): Node {
    const t = this.peek();
    if (t?.type === "op" && t.value === "-") {
      this.consume();
      return { kind: "neg", node: this.parseUnary() };
    }
    return this.parseAtom();
  }

  private parseAtom(): Node {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.type === "num") {
      this.consume();
      return { kind: "num", value: t.value, suffix: this.consumeOptionalUnit() };
    }
    if (t.type === "lparen") {
      this.consume();
      const inner = this.parseExpr();
      const close = this.peek();
      if (close?.type !== "rparen") throw new Error("Missing closing parenthesis");
      this.consume();
      return { kind: "group", inner, suffix: this.consumeOptionalUnit() };
    }
    throw new Error("Unexpected token");
  }

  private consumeOptionalUnit(): LengthUnit | null {
    const t = this.peek();
    if (t?.type === "unit") {
      this.consume();
      return t.value;
    }
    return null;
  }
}

function toMm(value: number, unit: LengthUnit): number {
  return value * UNIT_TO_MM[unit];
}

function evaluateNode(node: Node, ambientUnit: Unit | null): number {
  switch (node.kind) {
    case "num":
      if (node.suffix) return toMm(node.value, node.suffix);
      if (ambientUnit) return toMm(node.value, ambientUnit);
      return node.value;
    case "group": {
      // A group with its own suffix shields its contents from the ambient unit —
      // unsuffixed numbers inside it stay as plain numbers until the suffix is
      // applied once, here, to the combined result.
      const childAmbient = node.suffix ? null : ambientUnit;
      const inner = evaluateNode(node.inner, childAmbient);
      return node.suffix ? toMm(inner, node.suffix) : inner;
    }
    case "neg":
      return -evaluateNode(node.node, ambientUnit);
    case "binop": {
      const l = evaluateNode(node.left, ambientUnit);
      const r = evaluateNode(node.right, ambientUnit);
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return l / r;
      }
    }
  }
}

/**
 * Evaluates a dimension expression (plain number, unit-suffixed number/group, or
 * arithmetic combination thereof) to a value in mm. Returns null for empty or
 * unparseable input — callers should treat that as "not ready yet", not as zero.
 */
export function evaluateDimensionExpr(input: string, fieldUnit: Unit): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  try {
    const tokens = tokenize(trimmed);
    if (tokens.length === 0) return null;
    const result = evaluateNode(new Parser(tokens).parse(), fieldUnit);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
