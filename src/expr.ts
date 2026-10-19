// Lets dimension fields accept arithmetic expressions with inline unit suffixes, e.g.
// "15mm + (3/4*4)in" or "2ft + 30cm", and evaluates them to a single mm value.
//
// `fieldUnit` (the ambient/toggle unit) is only ever "mm" or "in" — that's all the
// app's unit toggle offers — but an explicit per-atom suffix can be any of the length
// units below, since those are just string literals typed by the user.
//
// Evaluation model: each additive term (an operand of + or -, i.e. a chain of only *
// and / within it) resolves independently to one final mm value, via
// `resolveAdditive`. Within a term, a trailing unit suffix scopes over everything
// accumulated in that term SO FAR, not just the adjacent factor — that's what makes
// bare "3/4in" mean "three quarters of an inch" (19.05mm), not "3 / (4 inches)"
// (0.0295mm, the literal first-draft bug this file now has a regression test for).
// A term with no suffix anywhere evaluates as pure unitless arithmetic first, THEN
// gets the field unit applied once to the combined result — converting each bare
// leaf independently before combining would be wrong for multiplication/division
// (e.g. "3*4" under inches would become (3·25.4)·(4·25.4) ≠ (3·4)·25.4) and is only
// safe for addition/subtraction, which distribute correctly either way.

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
  | { kind: "num"; value: number }
  | { kind: "scaled"; inner: Node; unit: LengthUnit }
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

  // A term is a chain of factors joined by * or /. A unit suffix appearing right
  // after the first factor, or right after any intermediate combined result, scales
  // everything accumulated in the chain SO FAR — not just the adjacent factor.
  private parseTerm(): Node {
    let node = this.maybeApplyTrailingUnit(this.parseUnary());
    for (;;) {
      const t = this.peek();
      if (t?.type !== "op" || (t.value !== "*" && t.value !== "/")) break;
      this.consume();
      node = { kind: "binop", op: t.value, left: node, right: this.parseUnary() };
      node = this.maybeApplyTrailingUnit(node);
    }
    return node;
  }

  private maybeApplyTrailingUnit(node: Node): Node {
    const t = this.peek();
    if (t?.type === "unit") {
      this.consume();
      return { kind: "scaled", inner: node, unit: t.value };
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

  // The true atom level: a bare number (no suffix consumed here — a bare number's
  // suffix might need to scope back over the whole term, which is parseTerm's job),
  // or a parenthesized group, which DOES bind a trailing suffix tightly to itself
  // (parens are an explicit, unambiguous boundary — e.g. "(3/4*4)in").
  private parseAtom(): Node {
    const t = this.peek();
    if (!t) throw new Error("Unexpected end of expression");
    if (t.type === "num") {
      this.consume();
      return { kind: "num", value: t.value };
    }
    if (t.type === "lparen") {
      this.consume();
      const inner = this.parseExpr();
      const close = this.peek();
      if (close?.type !== "rparen") throw new Error("Missing closing parenthesis");
      this.consume();
      const suffix = this.consumeOptionalUnit();
      return suffix ? { kind: "scaled", inner, unit: suffix } : inner;
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

function containsScale(node: Node): boolean {
  switch (node.kind) {
    case "num":
      return false;
    case "scaled":
      return true;
    case "neg":
      return containsScale(node.node);
    case "binop":
      return containsScale(node.left) || containsScale(node.right);
  }
}

function combine(op: "+" | "-" | "*" | "/", l: number, r: number): number {
  switch (op) {
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

// Pure, unitless arithmetic — a "scaled" node resolves itself via its own embedded
// unit regardless of context, and its result is then just a number to whatever
// contains it (already in mm, never rescaled again).
function evalPure(node: Node): number {
  switch (node.kind) {
    case "num":
      return node.value;
    case "scaled":
      return toMm(evalPure(node.inner), node.unit);
    case "neg":
      return -evalPure(node.node);
    case "binop":
      return combine(node.op, evalPure(node.left), evalPure(node.right));
  }
}

// Resolves each additive term independently to a final mm value, then sums. A term
// with an explicit unit anywhere in it is evaluated as pure arithmetic and already
// trusted to be in mm (via its own "scaled" node(s)); a term with no unit info at all
// is evaluated as pure arithmetic ONCE, then converted via fieldUnit ONCE — not per
// leaf, which is what keeps e.g. "3 * 4" correct when fieldUnit is "in".
function resolveAdditive(node: Node, fieldUnit: Unit): number {
  if (node.kind === "binop" && (node.op === "+" || node.op === "-")) {
    const l = resolveAdditive(node.left, fieldUnit);
    const r = resolveAdditive(node.right, fieldUnit);
    return node.op === "+" ? l + r : l - r;
  }
  if (node.kind === "neg") {
    return -resolveAdditive(node.node, fieldUnit);
  }
  return containsScale(node) ? evalPure(node) : toMm(evalPure(node), fieldUnit);
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
    const result = resolveAdditive(new Parser(tokens).parse(), fieldUnit);
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}
