// A single arc lying horizontally — the groove's circular cross-section, as seen
// from the side (see geometry/chord.ts).
export function ChordIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 8 Q12 19 21 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
