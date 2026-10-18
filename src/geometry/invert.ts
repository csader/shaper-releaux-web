/** Bisection solve for θ given a target Z, over a monotonic depth function. */
export function solveThetaForDepth(
  targetZ: number,
  thetaMin: number,
  thetaMax: number,
  depthFn: (theta: number) => number,
): number {
  let lo = thetaMin;
  let hi = thetaMax;
  const increasing = depthFn(hi) > depthFn(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const d = depthFn(mid);
    if (increasing === d < targetZ) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
