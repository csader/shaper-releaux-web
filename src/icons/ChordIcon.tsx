// Fluted-stave motif: a few parallel grooves, each drawn as a shallow arc to suggest
// the chord tool's circular cross-section (see geometry/chord.ts).
export function ChordIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 3 Q4 12 6 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12 3 Q10 12 12 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.75" />
      <path d="M18 3 Q16 12 18 21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}
