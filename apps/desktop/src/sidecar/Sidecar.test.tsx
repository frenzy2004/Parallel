// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TwinEvent } from "@parallel/contracts/events";
import { Sidecar } from "./Sidecar.js";

const recognizedEvent: TwinEvent = {
  state: "recognized",
  label: "moment equilibrium",
  signature: {
    domain: "statics_2d",
    patternId: "moment_about_point",
    entities: ["force", "point A"],
    relationships: ["force acts away from point A"],
    constraints: ["counter-clockwise positive"],
    goal: "signed moment",
    invariant: "M = Fd",
    courseConvention: "counter-clockwise positive",
    missingContext: [],
    confidence: 0.97,
    exaQuery: "introductory statics moment about a point worked example",
  },
};

const events: TwinEvent[] = [
  { state: "reading" },
  recognizedEvent,
  {
    state: "twin_step",
    index: 0,
    step: {
      id: "step-1",
      explanation: "Take moments about A.",
      expression: "ΣM_A = 0",
    },
  },
  {
    state: "complete",
    twin: {
      patternId: "moment_about_point",
      twinStatement: "A sign bracket carries an offset force.",
      workedSteps: [
        {
          id: "step-1",
          explanation: "Take moments about A.",
          expression: "ΣM_A = 0",
        },
      ],
      mappingEdges: [
        {
          twinAnchorId: "force",
          originalAnchorId: "force",
          label: "applied force",
        },
      ],
      sourceRefs: [],
      difficultyDelta: 0,
      answerLeak: false,
      confidence: 0.97,
      rejectionReason: null,
    },
  },
];

afterEach(cleanup);

describe("Sidecar", () => {
  it.each(events)("announces the $state streamed state accessibly", (event) => {
    render(<Sidecar events={[event]} onDismiss={() => undefined} />);
    expect(screen.getByRole("status")).toHaveTextContent(/\S+/);
  });

  it("dismisses on Escape", () => {
    const onDismiss = vi.fn();
    render(<Sidecar events={events} onDismiss={onDismiss} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
