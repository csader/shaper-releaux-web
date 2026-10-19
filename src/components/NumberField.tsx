import { useEffect, useState } from "react";
import { mmToDisplay, unitLabel, type Unit } from "../units";
import { evaluateDimensionExpr } from "../expr";

interface NumberFieldProps {
  label: string;
  valueMm: number;
  onChangeMm: (mm: number) => void;
  unit: Unit;
}

function formatDisplay(valueMm: number, unit: Unit): string {
  return String(mmToDisplay(valueMm, unit));
}

/**
 * Dimension input that accepts plain numbers (interpreted in the field's current
 * mm/in toggle), explicit unit suffixes that override the toggle (e.g. "5in" while in
 * mm mode), and arithmetic expressions mixing both (e.g. "15mm + (3/4*4)in") — see
 * expr.ts for the evaluation rules. Live-evaluates on every keystroke; an incomplete
 * or invalid expression is shown (not silently discarded) but doesn't propagate until
 * it resolves, and reverts to the last valid value on blur.
 */
export function NumberField({ label, valueMm, onChangeMm, unit }: NumberFieldProps) {
  const [text, setText] = useState(() => formatDisplay(valueMm, unit));
  const [focused, setFocused] = useState(false);
  const [invalid, setInvalid] = useState(false);

  // Keep the displayed text in sync with external changes (unit toggle, another
  // field recomputing this one, etc.) — but only while not focused, so we don't
  // clobber an in-progress expression on every parent re-render.
  useEffect(() => {
    if (!focused) setText(formatDisplay(valueMm, unit));
  }, [valueMm, unit, focused]);

  function handleChange(raw: string) {
    setText(raw);
    const mm = evaluateDimensionExpr(raw, unit);
    if (mm === null) {
      setInvalid(raw.trim() !== "");
      return;
    }
    setInvalid(false);
    onChangeMm(mm);
  }

  function handleBlur() {
    setFocused(false);
    setText(formatDisplay(valueMm, unit));
    setInvalid(false);
  }

  return (
    <label className="field">
      <span>
        {label} ({unitLabel(unit)})
      </span>
      <input
        type="text"
        className={invalid ? "invalid" : undefined}
        value={text}
        onFocus={() => setFocused(true)}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={handleBlur}
      />
    </label>
  );
}
