import { describe, expect, it } from "vitest";
import type { TwinRender } from "@parallel/contracts";
import { eventsForReopenedTwin } from "./precedent-reopen.js";

const twin: TwinRender = {
  patternId: "moment_about_point",
  twinStatement: "A prior verified twin.",
  workedSteps: [
    { id: "one", explanation: "First", expression: "ΣM_A = 0" },
    { id: "two", explanation: "Then", expression: "M = Fd" },
  ],
  mappingEdges: [
    {
      twinAnchorId: "force-line",
      originalAnchorId: "force-line",
      label: "force line",
      workedStepIds: ["one", "two"],
    },
  ],
  sourceRefs: [],
  difficultyDelta: 0,
  answerLeak: false,
  confidence: 0.98,
  rejectionReason: null,
};

describe("verified precedent reopen", () => {
  it("replays the stored worked steps and completion without recognition or evidence events", () => {
    expect(eventsForReopenedTwin(twin)).toEqual([
      { state: "twin_step", index: 0, step: twin.workedSteps[0] },
      { state: "twin_step", index: 1, step: twin.workedSteps[1] },
      { state: "complete", twin },
    ]);
  });
});
