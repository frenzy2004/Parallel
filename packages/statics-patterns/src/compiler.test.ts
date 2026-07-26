import { describe, expect, it } from "vitest";
import {
  StaticsPatternIdSchema,
  StructuralSignatureSchema,
  TwinRenderSchema,
  type StaticsPatternId,
  type StructuralSignature,
} from "@parallel/contracts";
import { compileVerifiedTwin } from "./compiler.js";
import { getPattern } from "./registry.js";
import type {
  DerivedQuantity,
  GeneratedStaticsCase,
} from "./types.js";

const originalAnchors: Record<StaticsPatternId, string[]> = {
  concurrent_force_equilibrium: ["force-intersection"],
  resultant_coplanar_forces: ["force-system"],
  moment_about_point: ["moment-center", "force-line"],
  rigid_body_equilibrium_2d: ["pin-support", "tension-member"],
  couple_moments: ["opposite-force-pair"],
  equivalent_distributed_load: ["distributed-load", "load-centroid"],
};

const makeSignature = (patternId: StaticsPatternId): StructuralSignature =>
  StructuralSignatureSchema.parse({
    domain: "statics_2d",
    patternId,
    entities: ["ladder", "wall reaction", "ground reaction"],
    relationships: ["forces act on one 2D free body"],
    constraints: ["counter-clockwise positive"],
    goal: "solve the unknown reaction",
    invariant:
      patternId === "moment_about_point"
        ? "sum of moments about a selected point is zero"
        : "the declared equilibrium structure is preserved",
    courseConvention: "counter-clockwise moments are positive",
    missingContext: [],
    confidence: 0.97,
    exaQuery: `introductory 2D statics worked example ${patternId}`,
    originalAnchorRegions: originalAnchors[patternId].map(
      (anchorId, index, anchors) => ({
        anchorId,
        region: {
          x: 0.05 + index / anchors.length,
          y: 0.2,
          width: 0.4,
          height: 0.6,
        },
      }),
    ),
  });

const momentSignature = makeSignature("moment_about_point");

const quantityToken = (formatted: string): string =>
  formatted.startsWith("-") ? formatted.slice(1) : formatted;

const numericTokens = (text: string): string[] =>
  [...text.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) =>
    quantityToken(match[0]!),
  );

const assertCaseIsClosedAndSolved = (generated: GeneratedStaticsCase): void => {
  const symbols = generated.quantities.map(({ symbol }) => symbol);
  expect(new Set(symbols).size).toBe(symbols.length);

  const givens = generated.quantities.filter(
    (quantity) => quantity.kind === "given",
  );
  const derived = generated.quantities.filter(
    (quantity): quantity is DerivedQuantity => quantity.kind === "derived",
  );
  const finals = derived.filter(({ final }) => final);

  for (const given of givens) {
    const separator = given.unit === "°" ? "" : " ";
    expect(generated.statement).toContain(
      `${given.formatted}${separator}${given.unit}`,
    );
  }

  expect(finals.map(({ symbol }) => symbol).sort()).toEqual(
    generated.unknowns.map(({ symbol }) => symbol).sort(),
  );
  for (const unknown of generated.unknowns) {
    expect(generated.statement).toContain(unknown.symbol);
    expect(
      finals.some(
        ({ symbol, unit, value }) =>
          symbol === unknown.symbol &&
          unit === unknown.unit &&
          Number.isFinite(value),
      ),
    ).toBe(true);
  }

  const availableSymbols = new Set(givens.map(({ symbol }) => symbol));
  for (const quantity of derived) {
    expect(quantity.derivedFrom.length).toBeGreaterThan(0);
    for (const dependency of quantity.derivedFrom) {
      expect(availableSymbols.has(dependency)).toBe(true);
    }
    expect(
      generated.workedSteps.some(({ id }) => id === quantity.stepId),
    ).toBe(true);
    availableSymbols.add(quantity.symbol);
  }

  const statementNumbers = new Set(
    numericTokens(generated.statement).concat(["0", "1", "2", "3", "180"]),
  );
  const availableNumbers = new Set(statementNumbers);
  for (const step of generated.workedSteps) {
    const introducedHere = derived
      .filter(({ stepId }) => stepId === step.id)
      .map(({ formatted }) => quantityToken(formatted));
    for (const token of numericTokens(step.expression)) {
      expect(
        availableNumbers.has(token) || introducedHere.includes(token),
        `${generated.scenario}/${step.id} introduced unexplained number ${token}`,
      ).toBe(true);
    }
    for (const token of introducedHere) {
      availableNumbers.add(token);
    }
  }

  const finalStep = generated.workedSteps.at(-1);
  expect(finalStep).toBeDefined();
  for (const answer of finals) {
    const separator = answer.unit === "°" ? "" : " ";
    expect(finalStep!.expression).toContain(
      `${answer.formatted}${separator}${answer.unit}`,
    );
  }
};

describe("verified Statics compiler", () => {
  it("changes surface details but preserves moment-equilibrium structure", () => {
    const twin = compileVerifiedTwin(momentSignature, 7);
    expect(twin.patternId).toBe("moment_about_point");
    expect(twin.twinStatement).not.toContain("ladder");
    expect(twin.workedSteps.at(-1)?.expression).toContain("N·m");
    expect(twin.answerLeak).toBe(false);
  });

  it("is deterministic for the same seed and changes every pattern surface across seeds", () => {
    for (const patternId of StaticsPatternIdSchema.options) {
      const signature = makeSignature(patternId);
      expect(compileVerifiedTwin(signature, 7)).toEqual(
        compileVerifiedTwin(signature, 7),
      );
      const surfaces = [7, 8, 9].map(
        (seed) => compileVerifiedTwin(signature, seed).twinStatement,
      );
      expect(new Set(surfaces).size).toBe(3);
    }
  });

  it("generates a schema-valid render for every pattern", () => {
    for (const patternId of StaticsPatternIdSchema.options) {
      const twin = compileVerifiedTwin(makeSignature(patternId), 19);
      const signature = makeSignature(patternId);
      expect(() => TwinRenderSchema.parse(twin)).not.toThrow();
      expect(twin).not.toHaveProperty("originalAnswer");
      expect(twin.mappingEdges.length).toBeGreaterThan(0);
      const stepIds = new Set(twin.workedSteps.map((step) => step.id));
      for (const edge of twin.mappingEdges) {
        expect(edge.workedStepIds?.length).toBeGreaterThan(0);
        expect(
          edge.workedStepIds?.every((stepId) => stepIds.has(stepId)),
        ).toBe(true);
      }
      expect(
        twin.mappingEdges.map(({ originalAnchorId }) => originalAnchorId).sort(),
      ).toEqual(
        signature.originalAnchorRegions
          .map(({ anchorId }) => anchorId)
          .sort(),
      );
    }
  });

  it("fails closed when original regions cannot join every mapping edge", () => {
    const signature = StructuralSignatureSchema.parse({
      ...makeSignature("moment_about_point"),
      originalAnchorRegions: [
        {
          anchorId: "unrecognized-feature",
          region: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
        },
      ],
    });

    expect(() => compileVerifiedTwin(signature, 19)).toThrow(
      /anchor|mapping/i,
    );
  });

  it("publishes closed, numerically solved cases with no unused bounds", () => {
    for (const patternId of StaticsPatternIdSchema.options) {
      const pattern = getPattern(patternId);
      expect(pattern.invariants.length).toBeGreaterThan(0);
      expect(pattern).not.toHaveProperty("numericBounds");
      expect(pattern.allowedMethods.length).toBeGreaterThan(0);
      expect(pattern.generateMappingAnchors().length).toBeGreaterThan(0);
      for (let seed = -8; seed <= 8; seed += 1) {
        assertCaseIsClosedAndSolved(pattern.generateCase(seed));
      }
    }
  });

  it.each([
    [
      "concurrent_force_equilibrium",
      ["T_L = 439.23 N", "T_R = 537.95 N"],
    ],
    [
      "resultant_coplanar_forces",
      ["R = 392.55 N", "θ_R = 66.76°"],
    ],
    ["moment_about_point", ["M_A = -405.95 N·m"]],
    [
      "rigid_body_equilibrium_2d",
      ["T = 500.00 N", "A_x = 400.00 N", "A_y = 300.00 N"],
    ],
    ["couple_moments", ["M_c = 96.00 N·m"]],
    [
      "equivalent_distributed_load",
      ["R = 24.00 kN", "x_R = 3.50 m"],
    ],
  ] as const)(
    "computes hand-checked seed-zero answers for %s",
    (patternId, expectedAnswers) => {
      const finalExpression = getPattern(patternId)
        .generateCase(0)
        .workedSteps.at(-1)?.expression;
      for (const expected of expectedAnswers) {
        expect(finalExpression).toContain(expected);
      }
    },
  );

  it("never copies original context or an original answer into the twin", () => {
    const signature = StructuralSignatureSchema.parse({
      ...makeSignature("rigid_body_equilibrium_2d"),
      entities: ["SECRET_ORIGINAL_LADDER_9137"],
      relationships: ["SECRET_ORIGINAL_REACTION_2718"],
      goal: "SECRET_ORIGINAL_ANSWER_3141_N",
    });
    const serializedTwin = JSON.stringify(compileVerifiedTwin(signature, 3));

    expect(serializedTwin).not.toContain("SECRET_ORIGINAL");
    expect(serializedTwin).not.toContain("3141");
    expect(serializedTwin).not.toContain("9137");
  });

  it("uses an unrounded numeric substitution for the signed moment", () => {
    const finalExpression = getPattern("moment_about_point")
      .generateCase(0)
      .workedSteps.at(-1)?.expression;

    expect(finalExpression).toContain(
      "-(2.4)(180) sin(30° + 40°) = -405.95 N·m",
    );
  });
});
