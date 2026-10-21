// An S-curve (ogee) riding a curved guide line, to distinguish this from the Chord
// tool's straight-line icon — the molding tool's whole point is following a curve.
export function MoldingIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 20 Q6 4 22 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
      <path
        d="M4 19 Q8 14 7 10 Q6 6 10 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
