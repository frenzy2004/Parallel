import {
  StructuralSignatureSchema,
  TwinRenderSchema,
  type StructuralSignature,
  type TwinRender,
} from "@parallel/contracts";
import { getPattern } from "./registry.js";

export const compileVerifiedTwin = (
  input: StructuralSignature,
  seed: number,
): TwinRender => {
  const signature = StructuralSignatureSchema.parse(input);
  if (signature.confidence < 0.8 || signature.missingContext.length > 0) {
    throw new Error("Signature is incomplete or below the safe compile threshold");
  }

  const pattern = getPattern(signature.patternId);
  return TwinRenderSchema.parse({
    patternId: pattern.id,
    twinStatement: pattern.generateSurface(seed),
    workedSteps: pattern.generateWorkedSteps(seed),
    mappingEdges: pattern.generateMappingAnchors(),
    sourceRefs: [],
    difficultyDelta: 0,
    answerLeak: false,
    confidence: signature.confidence,
    rejectionReason: null,
  });
};

export { getPattern, listPatterns } from "./registry.js";
