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
  const expectedAnchorIds = Object.keys(linkedStepIds[signature.patternId]);
  const receivedAnchorIds = signature.originalAnchorRegions.map(
    ({ anchorId }) => anchorId,
  );
  if (
    receivedAnchorIds.length !== expectedAnchorIds.length ||
    !expectedAnchorIds.every((anchorId) =>
      receivedAnchorIds.includes(anchorId),
    )
  ) {
    throw new Error("Signature anchors cannot join the verified mapping");
  }
  const workedSteps = pattern.generateWorkedSteps(seed);
  const validStepIds = new Set(workedSteps.map((step) => step.id));
  const mappingEdges = pattern
    .generateMappingAnchors()
    .filter((edge) => expectedAnchorIds.includes(edge.originalAnchorId))
    .map((edge) => ({
      ...edge,
      workedStepIds:
        linkedStepIds[signature.patternId][edge.originalAnchorId]?.filter(
          (stepId) => validStepIds.has(stepId),
        ) ?? [],
    }));
  if (
    mappingEdges.length !== expectedAnchorIds.length ||
    mappingEdges.some(({ workedStepIds }) => workedStepIds.length === 0)
  ) {
    throw new Error("Verified mapping is incomplete");
  }
  return TwinRenderSchema.parse({
    patternId: pattern.id,
    twinStatement: pattern.generateSurface(seed),
    workedSteps,
    mappingEdges,
    sourceRefs: [],
    difficultyDelta: 0,
    answerLeak: false,
    confidence: signature.confidence,
    rejectionReason: null,
  });
};

export { getPattern, listPatterns } from "./registry.js";
