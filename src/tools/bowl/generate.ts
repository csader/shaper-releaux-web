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
import { oddCircumradius } from "../../geometry/reuleauxPolygon";
import { outlineToPathData } from "../../svg/path";
import { buildShaperSvg, type CutPath } from "../../svg/shaperSvg";
import { splitIntoChunks } from "../../svg/fileSplit";
import type { GeneratedFile } from "../../types";
import { compoundShapeToPathData, scaleCompoundShape, type CompoundShape } from "../../geometry/customShape";

export interface BowlParams {
  sides: Sides | "custom";
  /** Required when sides === "custom" — normalized shape from the import picker. */
  customShape?: CompoundShape;
  outerDiameter: number;
  /** Independent Y dimension for sides=1 (ellipse) or sides=4 (rectangle special case). */
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
    customShape,
    outerDiameter,
    outerDiameterY,
    innerDiameter,
    innerDiameterY,
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

  if (sides === "custom" && !customShape) {
    throw new Error("A custom shape must be provided when sides is \"custom\".");
  }

  const footAngle = footAngleDeg(outerDiameter, footDiameter);
  const boundingWidth = outerDiameter + 2 * bitSize;
  const boundingHeight = (outerDiameterY ?? outerDiameter) + 2 * bitSize;
  const cx = outerDiameter / 2;
  // Odd-n true Reuleaux shapes (3, 5, 7) aren't symmetric around their own vertex
  // circumcenter — the single pointed vertex sticks out farther than the curved side
  // opposite it (confirmed against both the readme's own worked example and the real
  // pentagon sample's measured circumcenter). Left uncorrected, the vertex gets
  // clipped by the declared bounding box — most visible for the triangle, which has
  // by far the largest offset (~7.7% of D, vs ~2.6% for pentagon, ~1.3% for heptagon).
  // All rings share this one fixed centre (uniform scale toward one point), so the
  // offset only needs computing once, from the outer diameter.
  let cy = (outerDiameterY ?? outerDiameter) / 2;
  if (sides === 3 || sides === 5 || sides === 7) {
    cy -= oddCircumradius(sides, outerDiameter) - outerDiameter / 2;
  }
  const originX = -bitSize;
  const originY = -bitSize;
  const minCuttable = minCuttableDiameter(bitSize, mmCut);
  // Independent-axis shapes (ellipse n=1, rectangle n=4) scale the Y extent by this
  // same ratio at every ring — the single θ-driven profile scale factor applies
  // uniformly to both axes, just against different base dimensions. Custom imported
  // shapes already bake their own aspect ratio into the normalized form, so they
  // don't need this — scaleCompoundShape applies one uniform factor to both axes.
  const outerAspectY = (outerDiameterY ?? outerDiameter) / outerDiameter;
  const innerAspectY = (innerDiameterY ?? innerDiameter) / innerDiameter;

  /** Builds the `d` string for one ring, dispatching between the native arc-based
   * shapes and a custom imported (possibly multi-loop) shape. `dyScale` is ignored
   * for custom shapes (their own proportions are already baked in). `reversed`
   * matches the native `sweep` convention: false = normal, true = opposite winding
   * (used for the roughing pocket's inner "kept" shape). */
  const ringPathData = (D: number, dyScale: number, reversed: boolean): string => {
    if (sides === "custom") {
      const scaled = scaleCompoundShape(customShape!, D, cx, cy);
      return compoundShapeToPathData(scaled, reversed);
    }
    const outline = shapeOutline({ sides, diameter: D, dx: D, dy: D * dyScale, cx, cy, sweep: reversed ? 1 : 0 });
    return outlineToPathData(outline);
  };

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
    return {
      id: theta.toFixed(2),
      d: ringPathData(D, outerAspectY, false),
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
    return {
      id: theta.toFixed(2),
      d: ringPathData(D, innerAspectY, false),
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
  const stockBoundaryD = ringPathData(boundingWidth, boundingHeight / boundingWidth, false);

  const exteriorRoughPaths: CutPath[] = [];
  const zTop = exteriorDepth(90, { outerDepth, footHeight, zTouchHeight }, footAngle);
  const zFoot = exteriorDepth(footAngle, { outerDepth, footHeight, zTouchHeight }, footAngle);
  for (let z = ceilToStep(zFoot, ROUGH_Z_STEP); z < zTop; z += ROUGH_Z_STEP) {
    const theta = solveThetaForDepth(z, footAngle, 90, (t) =>
      exteriorDepth(t, { outerDepth, footHeight, zTouchHeight }, footAngle),
    );
    const D = exteriorDiameter(theta, outerDiameter);
    if (D < minCuttable) continue;
    exteriorRoughPaths.push({
      id: z.toFixed(2),
      d: `${stockBoundaryD} ${ringPathData(D, outerAspectY, true)}`,
      cutType: "pocket",
      cutDepthMm: round(z),
      toolDiaMm: bitSize,
    });
  }

  // Foot relief pocket: a shallow (1mm) pocket under the foot, included in the
  // exterior roughing file "only if there is sufficient room". Confirmed against a
  // real sample (Pear wood 5 sides): diameter = FootDiameter − (OuterDiameter −
  // InnerDiameter) [i.e. inset by the lip width on each side], depth = zFoot − 1mm.
  const lipWidth = (outerDiameter - innerDiameter) / 2;
  const reliefD = footDiameter - 2 * lipWidth;
  if (reliefD >= minCuttable) {
    exteriorRoughPaths.push({
      id: "Relief",
      d: ringPathData(reliefD, outerAspectY, false),
      cutType: "pocket",
      cutDepthMm: round(zFoot - 1),
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
    interiorRoughPaths.push({
      id: z.toFixed(2),
      d: ringPathData(D, innerAspectY, false),
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
