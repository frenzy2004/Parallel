import {
  StructuralSignatureSchema,
  TwinRenderSchema,
  type StructuralSignature,
  type TwinRender,
} from "@parallel/contracts";
import { getPattern } from "./registry.js";

const linkedStepIds: Record<
  StructuralSignature["patternId"],
  Record<string, string[]>
> = {
  concurrent_force_equilibrium: {
    "force-intersection": ["fbd", "equilibrium"],
  },
  resultant_coplanar_forces: {
    "force-system": ["components", "resultant"],
  },
  moment_about_point: {
    "moment-center": ["moment"],
    "force-line": ["lever-arm", "moment"],
  },
  rigid_body_equilibrium_2d: {
    "pin-support": ["fbd", "force-equilibrium"],
    "tension-member": ["fbd", "moment-equilibrium", "force-equilibrium"],
  },
  couple_moments: {
    "opposite-force-pair": ["couple", "moment"],
  },
  equivalent_distributed_load: {
    "distributed-load": ["area"],
    "load-centroid": ["centroid"],
  },
};

export const compileVerifiedTwin = (
  input: StructuralSignature,
  seed: number,
): TwinRender => {
  const signature = StructuralSignatureSchema.parse(input);
  if (signature.confidence < 0.8 || signature.missingContext.length > 0) {
    throw new Error("Signature is incomplete or below the safe compile threshold");
  }

  const pattern = getPattern(signature.patternId);
  const workedSteps = pattern.generateWorkedSteps(seed);
  const validStepIds = new Set(workedSteps.map((step) => step.id));
  return TwinRenderSchema.parse({
    patternId: pattern.id,
    twinStatement: pattern.generateSurface(seed),
    workedSteps,
    mappingEdges: pattern.generateMappingAnchors().map((edge) => ({
      ...edge,
      workedStepIds: (
        linkedStepIds[signature.patternId][edge.originalAnchorId] ??
        workedSteps.map((step) => step.id)
      ).filter((stepId) => validStepIds.has(stepId)),
    })),
    sourceRefs: [],
    difficultyDelta: 0,
    answerLeak: false,
    confidence: signature.confidence,
    rejectionReason: null,
  });
};

export { getPattern, listPatterns } from "./registry.js";
