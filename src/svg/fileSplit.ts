// Splits a long path list into chunks once it exceeds a practical per-file limit.
// The original app's own split (~270/52/50/61 in one sample) isn't a documented rule —
// treat this as "keep files manageable", not a geometry-affecting decision.

export function splitIntoChunks<T>(items: T[], maxPerFile = 250): T[][] {
  if (items.length <= maxPerFile) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerFile) {
    chunks.push(items.slice(i, i + maxPerFile));
  }
  return chunks;
}
