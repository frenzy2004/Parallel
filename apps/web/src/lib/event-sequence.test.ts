import type { TwinEvent } from "@parallel/contracts/events";
import { describe, expect, it } from "vitest";
import { isValidTwinEventSequence } from "./event-sequence";

const recognized: TwinEvent = {
  state: "recognized",
  label: "moment about point",
  signature: {
    domain: "statics_2d",
    patternId: "moment_about_point",
    entities: ["force"],
    relationships: ["offset force"],
    constraints: [],
    goal: "find moment",
    invariant: "M = r × F",
    courseConvention: "counter-clockwise positive",
    missingContext: [],
    confidence: 0.95,
    exaQuery: "introductory statics moment about point worked example",
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
  },
};

const complete: TwinEvent = {
  state: "complete",
  twin: {
    patternId: "moment_about_point",
    twinStatement: "A different bracket carries an offset force.",
    workedSteps: [
      {
        id: "moment",
        explanation: "Evaluate the moment.",
        expression: "M_A = r_x F_y - r_y F_x",
      },
    ],
    mappingEdges: [
      {
        twinAnchorId: "pin-a",
        originalAnchorId: "moment-center",
        label: "moment center",
        workedStepIds: ["moment"],
      },
      {
        twinAnchorId: "force",
        originalAnchorId: "force-line",
        label: "force line",
        workedStepIds: ["moment"],
      },
    ],
    sourceRefs: [],
    difficultyDelta: 0,
    answerLeak: false,
    confidence: 0.95,
    rejectionReason: null,
  },
};

describe("twin event sequence", () => {
  it("accepts a complete, ordered engine transcript", () => {
    expect(
      isValidTwinEventSequence([
        { state: "reading" },
        recognized,
        { state: "twin_step", index: 0, step: complete.twin.workedSteps[0]! },
        complete,
      ]),
    ).toBe(true);
  });

  it("compares streamed step fields independent of object key order", () => {
    const completeStep = complete.twin.workedSteps[0]!;
    const reorderedStep = {
      expression: completeStep.expression,
      explanation: completeStep.explanation,
      id: completeStep.id,
    };

    expect(
      isValidTwinEventSequence([
        { state: "reading" },
        recognized,
        { state: "twin_step", index: 0, step: reorderedStep },
        complete,
      ]),
    ).toBe(true);
  });

  it.each([
    { events: [{ state: "reading" }] },
    { events: [complete] },
    { events: [{ state: "reading" }, complete] },
    {
      events: [
        { state: "reading" },
        { state: "unsupported", reason: "not Statics" },
        complete,
      ],
    },
    {
      events: [
        { state: "reading" },
        recognized,
        { state: "twin_step", index: 2, step: complete.twin.workedSteps[0]! },
        complete,
      ],
    },
  ] satisfies Array<{ events: TwinEvent[] }>)(
    "rejects an impossible transcript",
    ({ events }) => {
      expect(isValidTwinEventSequence(events)).toBe(false);
    },
  );
});
