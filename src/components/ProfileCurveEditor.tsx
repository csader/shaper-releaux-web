import { useRef, useState } from "react";
import { evaluateCustomProfile, type CustomProfile, type ProfilePoint } from "../geometry/customProfile";

const WIDTH = 240;
const HEIGHT = 150;
const PAD = 20;
const MIN_GAP = 0.03; // minimum normalized r separation enforced between neighboring points

function toScreen(p: ProfilePoint): { x: number; y: number } {
  return { x: PAD + p.r * (WIDTH - 2 * PAD), y: PAD + p.z * (HEIGHT - 2 * PAD) };
}

function fromScreen(x: number, y: number): ProfilePoint {
  const r = (x - PAD) / (WIDTH - 2 * PAD);
  const z = (y - PAD) / (HEIGHT - 2 * PAD);
  return { r: Math.min(1, Math.max(0, r)), z: Math.min(1, Math.max(0, z)) };
}

function curvePathData(profile: CustomProfile, samples = 60): string {
  const parts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const { r, z } = evaluateCustomProfile(profile, i / samples);
    const { x, y } = toScreen({ r, z });
    parts.push(`${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return parts.join(" ");
}

interface ProfileCurveEditorProps {
  profile: CustomProfile;
  onChange: (profile: CustomProfile) => void;
  /** Label for the r=0 end, e.g. "Center" (interior) or "Foot" (exterior). */
  startLabel: string;
  /** Label for the r=1 end — always "Rim". */
  endLabel: string;
}

/**
 * Pen-tool-style editor for a bowl surface's depth profile: click to add a point,
 * drag to move one, double-click to remove it (endpoints are fixed at r=0/r=1 and
 * can't be removed, only dragged in depth). A monotonic cubic (see
 * geometry/customProfile.ts) is drawn live through the points. Points are clamped
 * during drag/insert to stay monotonic in both r and z — a physical requirement, not
 * just tidiness: a bit cutting from directly above can't undercut.
 */
export function ProfileCurveEditor({ profile, onChange, startLabel, endLabel }: ProfileCurveEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const points = profile.points;
  // Direction established by the two (fixed-r) endpoints — decides which way the
  // neighbor clamp runs for every point in between.
  const increasing = points[points.length - 1].z >= points[0].z;

  function toLocal(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  }

  function clamp(index: number, candidate: ProfilePoint): ProfilePoint {
    const isEndpoint = index === 0 || index === points.length - 1;
    let { r, z } = candidate;
    if (isEndpoint) {
      r = index === 0 ? 0 : 1;
    } else {
      const minR = points[index - 1].r + MIN_GAP;
      const maxR = points[index + 1].r - MIN_GAP;
      r = Math.min(Math.max(r, minR), maxR);
    }
    const prevZ = index > 0 ? points[index - 1].z : increasing ? 0 : 1;
    const nextZ = index < points.length - 1 ? points[index + 1].z : increasing ? 1 : 0;
    const lo = Math.min(prevZ, nextZ);
    const hi = Math.max(prevZ, nextZ);
    z = Math.min(Math.max(z, lo), hi);
    return { r, z };
  }

  function updatePoint(index: number, next: ProfilePoint) {
    const newPoints = points.slice();
    newPoints[index] = clamp(index, next);
    onChange({ points: newPoints });
  }

  function handlePointerDownOnPoint(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDraggingIndex(index);
  }

  function handleBackgroundClick(e: React.MouseEvent<SVGSVGElement>) {
    const local = toLocal(e);
    if (!local) return;
    const candidate = fromScreen(local.x, local.y);
    let insertAt = points.findIndex((p) => p.r > candidate.r);
    if (insertAt === -1) insertAt = points.length - 1;
    if (insertAt <= 0) insertAt = 1;
    const prev = points[insertAt - 1];
    const next = points[insertAt];
    if (next.r - prev.r < MIN_GAP * 2) return; // no room for a new point here
    const r = Math.min(Math.max(candidate.r, prev.r + MIN_GAP), next.r - MIN_GAP);
    const z = Math.min(Math.max(candidate.z, Math.min(prev.z, next.z)), Math.max(prev.z, next.z));
    const newPoints = points.slice();
    newPoints.splice(insertAt, 0, { r, z });
    onChange({ points: newPoints });
  }

  function handlePointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (draggingIndex === null) return;
    const local = toLocal(e);
    if (!local) return;
    updatePoint(draggingIndex, fromScreen(local.x, local.y));
  }

  function handleRemovePoint(index: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (index === 0 || index === points.length - 1) return; // endpoints are fixed
    if (points.length <= 2) return;
    const newPoints = points.slice();
    newPoints.splice(index, 1);
    onChange({ points: newPoints });
  }

  return (
    <div className="profile-curve-editor">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="profile-curve-svg"
        onClick={handleBackgroundClick}
        onPointerMove={handlePointerMove}
        onPointerUp={() => setDraggingIndex(null)}
      >
        <rect x={PAD} y={PAD} width={WIDTH - 2 * PAD} height={HEIGHT - 2 * PAD} className="profile-curve-bg" />
        <path d={curvePathData(profile)} className="profile-curve-path" />
        {points.map((p, i) => {
          const { x, y } = toScreen(p);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={5}
              className="profile-curve-point"
              onPointerDown={(e) => handlePointerDownOnPoint(i, e)}
              onDoubleClick={(e) => handleRemovePoint(i, e)}
              onClick={(e) => e.stopPropagation()}
            />
          );
        })}
        <text x={PAD} y={PAD - 6} className="profile-curve-axis-label">
          Shallow
        </text>
        <text x={PAD} y={HEIGHT - PAD + 14} className="profile-curve-axis-label">
          Deep
        </text>
        <text x={PAD} y={HEIGHT - 4} className="profile-curve-axis-label">
          {startLabel}
        </text>
        <text x={WIDTH - PAD} y={HEIGHT - 4} textAnchor="end" className="profile-curve-axis-label">
          {endLabel}
        </text>
      </svg>
      <p className="hint-note">Click to add a point, drag to move, double-click to remove.</p>
    </div>
  );
}
