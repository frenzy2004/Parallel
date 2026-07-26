import type {
  MappingEdge,
  StaticsPatternId,
  WorkedStep,
} from "@parallel/contracts";
import type { NumericBounds, StaticsPattern } from "../types.js";

interface PatternConfig {
  id: StaticsPatternId;
  label: string;
  invariants: readonly string[];
  numericBounds: NumericBounds;
  allowedMethods: readonly string[];
  scenarios: readonly string[];
  statement(seed: number, scenario: string, force: number, distance: number): string;
  steps(seed: number, force: number, distance: number): WorkedStep[];
  anchors: ReadonlyArray<Omit<MappingEdge, "workedStepIds">>;
}

const boundedValue = (
  seed: number,
  salt: number,
  bounds: { min: number; max: number },
): number => {
  const span = bounds.max - bounds.min + 1;
  return bounds.min + (Math.abs(seed * salt + salt * 17) % span);
};

export const createPattern = (config: PatternConfig): StaticsPattern => ({
  id: config.id,
  label: config.label,
  invariants: config.invariants,
  numericBounds: config.numericBounds,
  allowedMethods: config.allowedMethods,
  generateSurface(seed) {
    const scenario = config.scenarios[Math.abs(seed) % config.scenarios.length]!;
    const force = boundedValue(seed, 13, config.numericBounds.forceN);
    const distance = boundedValue(seed, 7, config.numericBounds.distanceM);
    return config.statement(seed, scenario, force, distance);
  },
  generateWorkedSteps(seed) {
    const force = boundedValue(seed, 13, config.numericBounds.forceN);
    const distance = boundedValue(seed, 7, config.numericBounds.distanceM);
    return config.steps(seed, force, distance);
  },
  generateMappingAnchors() {
    return [...config.anchors];
  },
});
