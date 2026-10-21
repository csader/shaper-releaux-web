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
import { anchorTrianglePathData, resolveAnchorPoint, type AnchorConfig, type BoundingBox } from "../../svg/anchor";

export interface BowlParams {
  sides: Sides | "custom";
  /** Required when sides === "custom" — normalized shape from the import picker. */
  customShape?: CompoundShape;
  /** Original uploaded file's name (sans extension) — used only for file naming when
   * sides === "custom", in place of a built-in shape name like "Pentagon". */
  customShapeName?: string;
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
  /** Whether to include the foot relief pocket in the roughing file, when there's
   * room for it. Defaults to true (matching the original app's always-on behavior). */
  footRelief?: boolean;
  /** Optional Shaper Origin custom anchor marker, placed identically in every
   * generated file (they all share the same bounding box / coordinate space). */
  anchor?: AnchorConfig;
  /** The original app always includes a blue bounding-box guide rect in every file.
   * Off by default here; on for original-app fidelity. */
  includeBoundingBox?: boolean;
  /** The original app splits a finishing pass into partN files once its path list
   * gets long (confirmed via real sample output) — the exact threshold it uses isn't
   * documented, so this is an approximation, exposed here so it can be tuned. */
  maxPathsPerFile?: number;
  /** Which surface(s) to generate files for. Defaults to "two-sided" (both), matching
   * the original app's always-both behavior. */
  machining?: "two-sided" | "interior-only" | "exterior-only";
}

const ROUGH_Z_STEP = 4; // mm, per the vertical model used for all roughing passes

function minCuttableDiameter(bitSize: number, mmCut: number): number {
  return bitSize + 2 * mmCut;
}

/** The bounding box every generated file for one set of params shares — exposed so
 * the UI can align an anchor-marker preview/drag overlay to the same coordinates. */
export function boundingBoxFor(params: Pick<BowlParams, "outerDiameter" | "outerDiameterY" | "bitSize">): BoundingBox {
  return {
    width: params.outerDiameter + 2 * params.bitSize,
    height: (params.outerDiameterY ?? params.outerDiameter) + 2 * params.bitSize,
    originX: -params.bitSize,
    originY: -params.bitSize,
  };
}

/** The actual center every ring is scaled toward — exposed so the UI's "center"
 * anchor position lands on the shape's real center, not the bounding box's naive
 * midpoint (they differ for odd-n Reuleaux shapes; see the comment where this is
 * used in generateBowl). */
export function shapeCenterFor(params: Pick<BowlParams, "sides" | "outerDiameter" | "outerDiameterY">): {
  cx: number;
  cy: number;
} {
  const cx = params.outerDiameter / 2;
  let cy = (params.outerDiameterY ?? params.outerDiameter) / 2;
  if (params.sides === 3 || params.sides === 5 || params.sides === 7) {
    cy -= oddCircumradius(params.sides, params.outerDiameter) - params.outerDiameter / 2;
  }
  return { cx, cy };
}

const SIDE_NAMES: Partial<Record<Sides, string>> = {
  2: "Heart",
  3: "Triangle",
  5: "Pentagon",
  6: "Hexagon",
  7: "Heptagon",
};

/** Human-readable shape name for file naming — "Pentagon", "Ellipse", the uploaded
 * file's own name for a custom shape, etc. Not used anywhere geometry-affecting. */
export function shapeNameFor(params: Pick<BowlParams, "sides" | "outerDiameterY" | "customShapeName">): string {
  if (params.sides === "custom") return params.customShapeName?.trim() || "Custom";
  if (params.sides === 1) return params.outerDiameterY !== undefined ? "Ellipse" : "Circle";
  if (params.sides === 4) return params.outerDiameterY !== undefined ? "Rectangle" : "Square";
  return SIDE_NAMES[params.sides] ?? "Shape";
}

function sanitizeForFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "").trim() || "Shape";
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
    footRelief = true,
    anchor,
    includeBoundingBox = false,
    maxPathsPerFile = 250,
    machining = "two-sided",
  } = params;

  if (sides === "custom" && !customShape) {
    throw new Error("A custom shape must be provided when sides is \"custom\".");
  }

  const footAngle = footAngleDeg(outerDiameter, footDiameter);
  const box = boundingBoxFor(params);
  const boundingWidth = box.width;
  const boundingHeight = box.height;
  // Odd-n true Reuleaux shapes (3, 5, 7) aren't symmetric around their own vertex
  // circumcenter — the single pointed vertex sticks out farther than the curved side
  // opposite it (confirmed against both the readme's own worked example and the real
  // pentagon sample's measured circumcenter). Left uncorrected, the vertex gets
  // clipped by the declared bounding box — most visible for the triangle, which has
  // by far the largest offset (~7.7% of D, vs ~2.6% for pentagon, ~1.3% for heptagon).
  // All rings share this one fixed centre (uniform scale toward one point), so the
  // offset only needs computing once, from the outer diameter.
  const { cx, cy } = shapeCenterFor(params);
  const originX = box.originX;
  const originY = box.originY;
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
  if (footRelief && reliefD >= minCuttable) {
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
  // Every file for this run shares the same bounding box, so one anchor point (if
  // enabled) lands at the identical physical spot in each — the same registration
  // mark works across all four passes without re-measuring.
  const anchorPoint = anchor ? resolveAnchorPoint(anchor, box, { x: cx, y: cy }) : null;
  const anchorPathData = anchorPoint ? anchorTrianglePathData(anchorPoint.x, anchorPoint.y, anchor!.position) : undefined;

  const shapeName = sanitizeForFilename(shapeNameFor(params));

  const files: GeneratedFile[] = [];
  const addSplit = (step: number, label: string, kind: GeneratedFile["kind"], paths: CutPath[]) => {
    const chunks = splitIntoChunks(paths, maxPathsPerFile);
    chunks.forEach((chunk, i) => {
      const partSuffix = chunks.length > 1 && i > 0 ? ` - part${i + 1}` : "";
      const name = `Step ${step} - ${label} - ${shapeName}${partSuffix}.svg`;
      files.push({
        name,
        kind,
        content: buildShaperSvg({
          boundingWidthMm: boundingWidth,
          boundingHeightMm: boundingHeight,
          originX,
          originY,
          anchorPathData,
          includeBoundingBox,
          paths: chunk,
          comments,
          docName: name,
        }),
      });
    });
  };

  // Matches the original app documentation's own "Order Of Operations": interior
  // roughing, interior finishing, flip the wood over, exterior roughing, exterior
  // finishing — carving the interior first, while the stock is still fully intact.
  // Step numbers restart from 1 when only one surface is generated, rather than
  // jumping straight to 3/4, so a single-surface run still reads as "1, 2".
  let step = 0;
  if (machining !== "exterior-only") {
    addSplit(++step, "Interior Roughing", "interior-roughing", interiorRoughPaths);
    addSplit(++step, "Interior", "interior", interiorPaths);
  }
  if (machining !== "interior-only") {
    addSplit(++step, "Exterior Roughing", "exterior-roughing", exteriorRoughPaths);
    addSplit(++step, "Exterior", "exterior", exteriorPaths);
  }

  return files;
}

/** Rounds a cutDepthMm value, nudging an exact 0 to a vanishingly small negative
 * number first. Shaper Origin may treat a literal "0mm" cutDepth as unset and fall
 * back to whatever depth is currently dialed into the tool rather than actually
 * cutting to the surface — a tiny negative value is still a real (if imperceptible)
 * cut below the surface, so it can never be mistaken for "no depth given". Positive
 * would be wrong here: in this encoding more-negative means deeper, so a positive
 * nudge would mean "above the surface", i.e. don't cut at all. */
function round(n: number): number {
  const rounded = Math.round(n * 1e4) / 1e4;
  return rounded === 0 ? -0.001 : rounded;
}

function ceilToStep(v: number, step: number): number {
  return Math.ceil(v / step) * step;
}

function floorToStep(v: number, step: number): number {
  return Math.floor(v / step) * step;
}
