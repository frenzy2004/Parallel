import {
  StaticsPatternIdSchema,
  StructuralSignatureSchema,
  type StaticsPatternId,
  type StructuralSignature,
} from "@parallel/contracts";

type CanonicalPattern = Omit<
  StructuralSignature,
  "domain" | "patternId" | "missingContext" | "confidence"
>;

const CANONICAL_PATTERNS: Record<StaticsPatternId, CanonicalPattern> = {
  concurrent_force_equilibrium: {
    entities: ["common point", "applied forces", "unknown force magnitudes"],
    relationships: ["all force lines of action intersect at the common point"],
    constraints: ["horizontal and vertical force sums are zero"],
    goal: "determine the unknown concurrent forces",
    invariant: "all force lines intersect and ΣFx = 0 and ΣFy = 0",
    courseConvention: "positive x right and positive y up",
    exaQuery:
      "introductory 2D statics worked example concurrent force equilibrium components",
  },
  resultant_coplanar_forces: {
    entities: ["coplanar forces", "Cartesian components", "resultant force"],
    relationships: ["the resultant equals the vector sum of all applied forces"],
    constraints: ["x and y components sum independently"],
    goal: "determine the magnitude and direction of the resultant force",
    invariant: "R equals the vector sum of the coplanar forces",
    courseConvention: "angles measured counter-clockwise from positive x",
    exaQuery:
      "introductory 2D statics worked example resultant coplanar forces components",
  },
  moment_about_point: {
    entities: ["applied force", "moment center", "perpendicular distance"],
    relationships: [
      "force line of action is offset from the moment center",
    ],
    constraints: ["counter-clockwise moments are positive"],
    goal: "determine the signed moment about the selected point",
    invariant: "moment equals force times perpendicular distance",
    courseConvention: "counter-clockwise positive",
    exaQuery:
      "introductory 2D statics worked example moment about point counter-clockwise positive",
  },
  rigid_body_equilibrium_2d: {
    entities: ["rigid body", "applied loads", "support reactions"],
    relationships: ["support reactions and applied loads act on one rigid body"],
    constraints: ["ΣFx = 0", "ΣFy = 0", "ΣM = 0"],
    goal: "determine the unknown support reactions",
    invariant: "force and moment equilibrium hold simultaneously",
    courseConvention: "counter-clockwise moments are positive",
    exaQuery:
      "introductory 2D statics worked example rigid body equilibrium support reactions",
  },
  couple_moments: {
    entities: ["equal opposite forces", "perpendicular separation", "couple moment"],
    relationships: ["the opposite force pair has zero resultant force"],
    constraints: ["the couple moment is independent of reference point"],
    goal: "determine the equivalent signed couple moment",
    invariant: "couple moment equals force times perpendicular separation",
    courseConvention: "counter-clockwise positive",
    exaQuery:
      "introductory 2D statics worked example couple moment equal opposite forces",
  },
  equivalent_distributed_load: {
    entities: ["distributed load", "load diagram area", "centroid", "resultant force"],
    relationships: ["the resultant acts through the centroid of the load diagram"],
    constraints: ["resultant magnitude equals the load diagram area"],
    goal: "replace the distributed load with an equivalent point load",
    invariant: "resultant equals area and acts through the load diagram centroid",
    courseConvention: "distance measured from the loaded edge",
    exaQuery:
      "introductory 2D statics worked example equivalent distributed load centroid",
  },
};

const CANONICAL_EXA_QUERIES = new Set(
  Object.values(CANONICAL_PATTERNS).map(({ exaQuery }) => exaQuery),
);

export const buildCanonicalSignature = (
  patternId: unknown,
  confidence: unknown,
): StructuralSignature => {
  const validatedPatternId = StaticsPatternIdSchema.parse(patternId);
  const validatedConfidence = StructuralSignatureSchema.shape.confidence.parse(
    confidence,
  );
  return StructuralSignatureSchema.parse({
    domain: "statics_2d",
    patternId: validatedPatternId,
    ...CANONICAL_PATTERNS[validatedPatternId],
    missingContext: [],
    confidence: validatedConfidence,
  });
};

export const canonicalizeSignature = (
  input: StructuralSignature,
): StructuralSignature => {
  const validated = StructuralSignatureSchema.parse(input);
  return buildCanonicalSignature(validated.patternId, validated.confidence);
};

export const isCanonicalExaQuery = (query: string): boolean =>
  CANONICAL_EXA_QUERIES.has(query);
