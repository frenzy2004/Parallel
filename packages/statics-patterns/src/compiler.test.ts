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
    originalAnchorRegions: [
      {
        anchorId: "problem-feature",
        region: { x: 0.2, y: 0.2, width: 0.6, height: 0.6 },
      },
    ],
  });

const momentSignature = makeSignature("moment_about_point");

describe("verified Statics compiler", () => {
  it("changes surface details but preserves moment-equilibrium structure", () => {
    const twin = compileVerifiedTwin(momentSignature, 7);
    expect(twin.patternId).toBe("moment_about_point");
    expect(twin.twinStatement).not.toContain("ladder");
    expect(twin.workedSteps.at(-1)?.expression).toContain("ΣM");
    expect(twin.answerLeak).toBe(false);
  });

  it("is deterministic for the same seed and varies across seeds", () => {
    expect(compileVerifiedTwin(momentSignature, 7)).toEqual(
      compileVerifiedTwin(momentSignature, 7),
    );
    expect(compileVerifiedTwin(momentSignature, 8).twinStatement).not.toBe(
      compileVerifiedTwin(momentSignature, 7).twinStatement,
    );
  });

  it("generates a schema-valid render for every bounded pattern", () => {
    for (const patternId of StaticsPatternIdSchema.options) {
      const twin = compileVerifiedTwin(makeSignature(patternId), 19);
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
    }
  });

  it("publishes invariants, bounds, methods, and generators per pattern", () => {
    for (const patternId of StaticsPatternIdSchema.options) {
      const pattern = getPattern(patternId);
      expect(pattern.invariants.length).toBeGreaterThan(0);
      expect(pattern.numericBounds.forceN.min).toBeLessThan(
        pattern.numericBounds.forceN.max,
      );
      expect(pattern.allowedMethods.length).toBeGreaterThan(0);
      expect(pattern.generateWorkedSteps(3).length).toBeGreaterThan(0);
      expect(pattern.generateMappingAnchors().length).toBeGreaterThan(0);
    }
  });
});
