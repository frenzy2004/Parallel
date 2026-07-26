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
      workedStepIds: ["step-1"],
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
        originalAnchorRegions: [
          {
            anchorId: "force-line",
            region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
          },
        ],
      }),
    ).toThrow();
  });

  it("accepts only normalized original-anchor regions inside the lasso", () => {
    const signature = {
      domain: "statics_2d",
      patternId: "moment_about_point",
      entities: ["beam", "force"],
      relationships: ["force acts away from A"],
      constraints: ["counter-clockwise positive"],
      goal: "signed moment",
      invariant: "M = Fd",
      courseConvention: "counter-clockwise positive",
      missingContext: [],
      confidence: 0.97,
      exaQuery: "introductory statics moment about point",
      originalAnchorRegions: [
        {
          anchorId: "moment-center",
          region: { x: 0.08, y: 0.42, width: 0.12, height: 0.18 },
        },
        {
          anchorId: "force-line",
          region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
        },
      ],
    };

    expect(
      StructuralSignatureSchema.parse(signature).originalAnchorRegions,
    ).toHaveLength(2);
    expect(() =>
      StructuralSignatureSchema.parse({
        ...signature,
        originalAnchorRegions: [
          {
            anchorId: "force-line",
            region: { x: 0.9, y: 0.2, width: 0.2, height: 0.2 },
          },
        ],
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
