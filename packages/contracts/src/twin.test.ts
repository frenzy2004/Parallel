import { describe, expect, it } from "vitest";
import {
  PrecedentSchema,
  StructuralSignatureSchema,
  TwinRenderSchema,
} from "./twin.js";
import { TwinEventSchema } from "./events.js";

const validTwin = {
  patternId: "moment_about_point",
  twinStatement: "A sign bracket supports a 120 N load 2 m from point A.",
  workedSteps: [
    {
      id: "step-1",
      explanation: "Sum moments about A.",
      expression: "ΣM_A = 0",
    },
  ],
  mappingEdges: [
    {
      twinAnchorId: "twin-load",
      originalAnchorId: "original-load",
      label: "applied load",
    },
  ],
  sourceRefs: [],
  difficultyDelta: 0,
  answerLeak: false,
  confidence: 0.96,
  rejectionReason: null,
};

describe("PARALLEL product contracts", () => {
  it("rejects answer leakage and missing mapping anchors", () => {
    expect(() => TwinRenderSchema.parse({ ...validTwin, answerLeak: true })).toThrow();
    expect(() => TwinRenderSchema.parse({ ...validTwin, mappingEdges: [] })).toThrow();
  });

  it("bounds signature confidence and validates supported pattern ids", () => {
    expect(() =>
      StructuralSignatureSchema.parse({
        domain: "statics_2d",
        patternId: "moment_about_point",
        entities: ["beam", "force"],
        relationships: ["force acts 2 m from A"],
        constraints: ["counter-clockwise positive"],
        goal: "reaction moment",
        invariant: "moment equilibrium",
        courseConvention: "ΣM_A = 0",
        missingContext: [],
        confidence: 1.01,
        exaQuery: "introductory 2D statics moment equilibrium",
      }),
    ).toThrow();
  });

  it("uses exact discriminated streaming states", () => {
    const complete = TwinEventSchema.parse({
      state: "complete",
      twin: validTwin,
    });
    expect(complete.state).toBe("complete");
    expect(() => TwinEventSchema.parse({ state: "guessing" })).toThrow();
  });

  it("stores only abstract precedent fields", () => {
    const parsed = PrecedentSchema.parse({
      signatureHash: "sha256:abc",
      patternId: "moment_about_point",
      mappingSummary: "force ↔ force; pivot ↔ pivot",
      twinStyle: "sign-bracket",
      outcome: "unlocked",
      laterTransferOutcome: null,
      createdAt: "2026-07-26T00:00:00.000Z",
    });
    expect(parsed).not.toHaveProperty("cropDataUrl");
  });
});
