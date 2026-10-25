import type { ProfileCurve } from "../../geometry/profile";

interface Props {
  interiorCurve: ProfileCurve | null;
  exteriorCurve: ProfileCurve | null;
  /** 0 for a custom exterior curve (no separate foot), footAngleDeg otherwise. */
  exteriorStart: number;
  outerDiameter: number;
  outerDepth: number;
}

const SAMPLES = 60;

/** Samples a curve's own R (diameter) field as a true radius (R/2) from the center
 * axis, at `count+1` evenly spaced angles from thetaStart to thetaEnd. */
function sampleRadius(curve: ProfileCurve, thetaStart: number, thetaEnd: number, count: number) {
  const points: { radius: number; z: number }[] = [];
  for (let i = 0; i <= count; i++) {
    const t = thetaStart + ((thetaEnd - thetaStart) * i) / count;
    const { R, Z } = curve(t);
    points.push({ radius: R / 2, z: Z });
  }
  return points;
}

function round(n: number): number {
  return Math.round(n * 1e3) / 1e3;
}

function pathFor(points: { x: number; z: number }[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  return `M ${round(first.x)},${round(first.z)} ${rest.map((p) => `L ${round(p.x)},${round(p.z)}`).join(" ")}`;
}

/**
 * A true side-view slice through the bowl's center — the interior pocket's and
 * exterior wall's actual depth profile, mirrored left/right, in one shared top-down
 * frame (rim = Z=0 at the top; deeper = further down the image, matching how the
 * underlying cutDepth values already work — see generate.ts). This is what actually
 * distinguishes Elliptical vs. Circular vs. a flat bottom vs. a hand-drawn custom
 * curve; the top-down shaded previews elsewhere can't show that at all.
 *
 * Exterior's own curve is parametrized from its own top-down reference (the stock's
 * current top face during that operation, physically the bowl's underside once
 * flipped) — flipped here (outerDepth − Z) to express it in the same rim-at-top
 * global frame the interior curve is already in, so both can be drawn as one
 * consistent solid-body outline.
 */
export function CrossSectionPreview({ interiorCurve, exteriorCurve, exteriorStart, outerDiameter, outerDepth }: Props) {
  const halfOuter = outerDiameter / 2;
  const pad = Math.max(outerDiameter, outerDepth) * 0.08;

  let interiorPath = "";
  if (interiorCurve) {
    const right = sampleRadius(interiorCurve, 0, 90, SAMPLES);
    const left = [...right].reverse();
    interiorPath = pathFor([
      ...left.map((p) => ({ x: -p.radius, z: p.z })),
      ...right.map((p) => ({ x: p.radius, z: p.z })),
    ]);
  }

  let exteriorPath = "";
  if (exteriorCurve) {
    const right = sampleRadius(exteriorCurve, exteriorStart, 90, SAMPLES).map((p) => ({ radius: p.radius, z: outerDepth - p.z }));
    const left = [...right].reverse();
    const hasFoot = exteriorStart > 0 && right[0].radius > 0;
    exteriorPath = pathFor([
      ...left.map((p) => ({ x: -p.radius, z: p.z })),
      // Flat foot bottom — neither curve samples this flat middle segment, since it
      // isn't part of either profile's own domain.
      ...(hasFoot ? [{ x: right[0].radius, z: right[0].z }] : []),
      ...right.map((p) => ({ x: p.radius, z: p.z })),
    ]);
  }

  const viewMinX = -halfOuter - pad;
  const viewMinY = -pad;
  const viewWidth = outerDiameter + 2 * pad;
  const viewHeight = outerDepth + 2 * pad;

  return (
    <svg
      viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
      width="100%"
      style={{ maxHeight: 240, background: "#fff", borderRadius: 6 }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Rim reference line, for scale. */}
      <line x1={viewMinX} y1={0} x2={viewMinX + viewWidth} y2={0} stroke="#ccc" strokeWidth={outerDepth * 0.004} />
      {exteriorPath && <path d={exteriorPath} fill="none" stroke="#4a6cf7" strokeWidth={outerDepth * 0.01} />}
      {interiorPath && <path d={interiorPath} fill="none" stroke="#e8532a" strokeWidth={outerDepth * 0.01} />}
    </svg>
  );
}
