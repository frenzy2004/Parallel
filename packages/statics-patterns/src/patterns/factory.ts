import type {
  MappingEdge,
  StaticsPatternId,
} from "@parallel/contracts";
import type {
  DerivedQuantity,
  GeneratedStaticsCase,
  GivenQuantity,
  StaticsPattern,
} from "../types.js";

interface PatternConfig {
  id: StaticsPatternId;
  label: string;
  invariants: readonly string[];
  allowedMethods: readonly string[];
  buildCase(seed: number): GeneratedStaticsCase;
  anchors: readonly MappingEdge[];
}

export const selectVariant = <T>(
  seed: number,
  variants: readonly T[],
): T => {
  const index = ((Math.trunc(seed) % variants.length) + variants.length) %
    variants.length;
  return variants[index]!;
};

export const formatGiven = (value: number): string => String(value);

export const formatSolved = (value: number): string => value.toFixed(2);

export const given = (
  symbol: string,
  value: number,
  unit: string,
): GivenQuantity => ({
  kind: "given",
  symbol,
  value,
  formatted: formatGiven(value),
  unit,
});

export const derived = (
  symbol: string,
  value: number,
  unit: string,
  derivedFrom: readonly string[],
  stepId: string,
  final = false,
): DerivedQuantity => ({
  kind: "derived",
  symbol,
  value,
  formatted: formatSolved(value),
  unit,
  derivedFrom,
  stepId,
  final,
});

export const createPattern = (config: PatternConfig): StaticsPattern => {
  const generateCase = (seed: number): GeneratedStaticsCase =>
    config.buildCase(seed);

  return {
    id: config.id,
    label: config.label,
    invariants: config.invariants,
    allowedMethods: config.allowedMethods,
    generateCase,
    generateSurface(seed) {
      return generateCase(seed).statement;
    },
    generateWorkedSteps(seed) {
      return generateCase(seed).workedSteps;
    },
    generateMappingAnchors() {
      return [...config.anchors];
    },
  };
};
