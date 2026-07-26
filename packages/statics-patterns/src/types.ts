import type {
  MappingEdge,
  StaticsPatternId,
  WorkedStep,
} from "@parallel/contracts";

export interface NumericBounds {
  forceN: { min: number; max: number };
  distanceM: { min: number; max: number };
  angleDeg: { min: number; max: number };
}

export interface StaticsPattern {
  id: StaticsPatternId;
  label: string;
  invariants: readonly string[];
  numericBounds: NumericBounds;
  allowedMethods: readonly string[];
  generateSurface(seed: number): string;
  generateWorkedSteps(seed: number): WorkedStep[];
  generateMappingAnchors(): Array<Omit<MappingEdge, "workedStepIds">>;
}
