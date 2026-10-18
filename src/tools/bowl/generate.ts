import {
  exteriorDepth,
  exteriorDiameter,
  footAngleDeg,
  interiorDepth,
  interiorDiameter,
  stepAngles,
  type SteppingModel,
} from "../../geometry/profile";
import { solveThetaForDepth } from "../../geometry/invert";
import { shapeOutline, type Sides } from "../../geometry/shapes";
import { outlineToPathData } from "../../svg/path";
import { buildShaperSvg, type CutPath } from "../../svg/shaperSvg";
import { splitIntoChunks } from "../../svg/fileSplit";
import type { GeneratedFile } from "../../types";

export interface BowlParams {
  sides: Sides;
  outerDiameter: number;
  /** Only meaningful for sides=1 (ellipse); n=4 rectangle is a known V1 gap — see plan. */
  outerDiameterY?: number;
  innerDiameter: number;
  innerDiameterY?: number;
  outerDepth: number;
  innerDepth: number;
  footHeight: number;
  footDiameter: number;
  zTouchHeight: number;
  bitSize: number;
  mmCut: number;
  interiorModel: SteppingModel;
  exteriorModel: SteppingModel;
}

const ROUGH_Z_STEP = 4; // mm, per the vertical model used for all roughing passes

function minCuttableDiameter(bitSize: number, mmCut: number): number {
  return bitSize + 2 * mmCut;
}

export function generateBowl(params: BowlParams): GeneratedFile[] {
  const {
    sides,
    outerDiameter,
    outerDiameterY,
    innerDiameter,
    outerDepth,
    innerDepth,
    footHeight,
    footDiameter,
    zTouchHeight,
    bitSize,
    mmCut,
    interiorModel,
    exteriorModel,
  } = params;

  const footAngle = footAngleDeg(outerDiameter, footDiameter);
  const boundingWidth = outerDiameter + 2 * bitSize;
  const boundingHeight = (outerDiameterY ?? outerDiameter) + 2 * bitSize;
  const cx = outerDiameter / 2;
  const cy = (outerDiameterY ?? outerDiameter) / 2;
  const originX = -bitSize;
  const originY = -bitSize;
  const minCuttable = minCuttableDiameter(bitSize, mmCut);

  const comments: Record<string, string | number> = {
    "Outer Diameter": outerDiameter,
    "Inner Diameter": innerDiameter,
    "Outer Depth": outerDepth,
    "Inner Depth": innerDepth,
    "Foot Height": footHeight,
    "Foot Diameter": footDiameter,
    "Z Touch Height": zTouchHeight,
    "Bit Size": bitSize,
    "MM Cut": mmCut,
  };

  const exteriorCurve = (theta: number) => ({
    R: exteriorDiameter(theta, outerDiameter),
    Z: exteriorDepth(theta, { outerDepth, footHeight, zTouchHeight }, footAngle),
  });
  const interiorCurve = (theta: number) => ({
    R: interiorDiameter(theta, innerDiameter),
    Z: interiorDepth(theta, innerDepth, outerDepth, zTouchHeight),
  });

  // --- Finishing passes --------------------------------------------------
  const exteriorThetas = stepAngles(footAngle, 90, mmCut, exteriorModel, exteriorCurve).filter(
    (t) => exteriorDiameter(t, outerDiameter) >= minCuttable,
  );
  const exteriorPaths: CutPath[] = exteriorThetas.map((theta) => {
    const D = exteriorDiameter(theta, outerDiameter);
    const Z = exteriorDepth(theta, { outerDepth, footHeight, zTouchHeight }, footAngle);
    const outline = shapeOutline({ sides, diameter: D, dx: D, dy: D, cx, cy, sweep: 0 });
    return {
      id: theta.toFixed(2),
      d: outlineToPathData(outline),
      cutType: "outside",
      cutDepthMm: round(Z),
      toolDiaMm: bitSize,
    };
  });

  const interiorThetas = stepAngles(0, 90, mmCut, interiorModel, interiorCurve).filter(
    (t) => interiorDiameter(t, innerDiameter) >= minCuttable,
  );
  const interiorPaths: CutPath[] = interiorThetas.map((theta) => {
    const D = interiorDiameter(theta, innerDiameter);
    const Z = interiorDepth(theta, innerDepth, outerDepth, zTouchHeight);
    const outline = shapeOutline({ sides, diameter: D, dx: D, dy: D, cx, cy, sweep: 1 });
    return {
      id: theta.toFixed(2),
      d: outlineToPathData(outline),
      cutType: "inside",
      cutDepthMm: round(Z),
      toolDiaMm: bitSize,
    };
  });

  // --- Roughing passes (vertical model: fixed 4mm Z steps) ---------------
  // Exterior roughing: pocket between the fixed stock boundary and the shrinking
  // "keep" shape, stepping down from just below the lip to just above the foot.
  // Matches the sample convention: the roughing pocket's outer boundary is the same
  // shape silhouette scaled up to the bounding box size, not a plain rectangle.
  const stockBoundary = shapeOutline({ sides, diameter: boundingWidth, dx: boundingWidth, dy: boundingHeight, cx, cy, sweep: 0 });
  const stockBoundaryD = outlineToPathData(stockBoundary);

  const exteriorRoughPaths: CutPath[] = [];
  const zTop = exteriorDepth(90, { outerDepth, footHeight, zTouchHeight }, footAngle);
  const zFoot = exteriorDepth(footAngle, { outerDepth, footHeight, zTouchHeight }, footAngle);
  for (let z = ceilToStep(zFoot, ROUGH_Z_STEP); z < zTop; z += ROUGH_Z_STEP) {
    const theta = solveThetaForDepth(z, footAngle, 90, (t) =>
      exteriorDepth(t, { outerDepth, footHeight, zTouchHeight }, footAngle),
    );
    const D = exteriorDiameter(theta, outerDiameter);
    if (D < minCuttable) continue;
    const outline = shapeOutline({ sides, diameter: D, dx: D, dy: D, cx, cy, sweep: 1 });
    exteriorRoughPaths.push({
      id: z.toFixed(2),
      d: `${stockBoundaryD} ${outlineToPathData(outline)}`,
      cutType: "pocket",
      cutDepthMm: round(z),
      toolDiaMm: bitSize,
    });
  }

  // Interior roughing: simple pocket (no outer boundary needed) clearing down to
  // just short of final interior depth.
  const interiorRoughPaths: CutPath[] = [];
  const zBottom = interiorDepth(0, innerDepth, outerDepth, zTouchHeight);
  const zRim = interiorDepth(90, innerDepth, outerDepth, zTouchHeight);
  for (let z = floorToStep(zBottom, ROUGH_Z_STEP); z > zRim; z -= ROUGH_Z_STEP) {
    const theta = solveThetaForDepth(z, 0, 90, (t) => interiorDepth(t, innerDepth, outerDepth, zTouchHeight));
    const D = interiorDiameter(theta, innerDiameter);
    if (D < minCuttable) continue;
    const outline = shapeOutline({ sides, diameter: D, dx: D, dy: D, cx, cy, sweep: 0 });
    interiorRoughPaths.push({
      id: z.toFixed(2),
      d: outlineToPathData(outline),
      cutType: "pocket",
      cutDepthMm: round(z),
      toolDiaMm: bitSize,
    });
  }

  // --- Assemble files, splitting long finishing-pass lists --------------
  const files: GeneratedFile[] = [];
  const addSplit = (basename: string, paths: CutPath[]) => {
    const chunks = splitIntoChunks(paths);
    chunks.forEach((chunk, i) => {
      const suffix = chunks.length > 1 ? (i === 0 ? "" : `part${i + 1}`) : "";
      const name = `${basename}${suffix}.svg`;
      files.push({
        name,
        content: buildShaperSvg({
          boundingWidthMm: boundingWidth,
          boundingHeightMm: boundingHeight,
          originX,
          originY,
          paths: chunk,
          comments,
          docName: name,
        }),
      });
    });
  };

  addSplit("ReuleauxExterior", exteriorPaths);
  addSplit("ReuleauxExteriorRoughing", exteriorRoughPaths);
  addSplit("ReuleauxInterior", interiorPaths);
  addSplit("ReuleauxInteriorRoughing", interiorRoughPaths);

  return files;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

function ceilToStep(v: number, step: number): number {
  return Math.ceil(v / step) * step;
}

function floorToStep(v: number, step: number): number {
  return Math.floor(v / step) * step;
}
