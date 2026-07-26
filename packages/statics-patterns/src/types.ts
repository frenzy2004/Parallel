import type {
  MappingEdge,
  StaticsPatternId,
  WorkedStep,
} from "@parallel/contracts";

interface QuantityBase {
  symbol: string;
  value: number;
  formatted: string;
  unit: string;
}

export interface GivenQuantity extends QuantityBase {
  kind: "given";
}

export interface DerivedQuantity extends QuantityBase {
  kind: "derived";
  derivedFrom: readonly string[];
  stepId: string;
  final: boolean;
}

export type CaseQuantity = GivenQuantity | DerivedQuantity;

export interface CaseUnknown {
  symbol: string;
  unit: string;
}

export interface GeneratedStaticsCase {
  scenario: string;
  statement: string;
  unknowns: readonly CaseUnknown[];
  quantities: readonly CaseQuantity[];
  workedSteps: WorkedStep[];
}

export interface StaticsPattern {
  id: StaticsPatternId;
  label: string;
  invariants: readonly string[];
  allowedMethods: readonly string[];
  generateCase(seed: number): GeneratedStaticsCase;
  generateSurface(seed: number): string;
  generateWorkedSteps(seed: number): WorkedStep[];
  generateMappingAnchors(): MappingEdge[];
}
