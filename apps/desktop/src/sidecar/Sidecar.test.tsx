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
    originalAnchorRegions: [
      {
        anchorId: "force",
        region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
      },
      {
        anchorId: "moment-center",
        region: { x: 0.08, y: 0.42, width: 0.12, height: 0.18 },
      },
    ],
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
          workedStepIds: ["step-1"],
        },
        {
          twinAnchorId: "pin",
          originalAnchorId: "moment-center",
          label: "moment center",
          workedStepIds: ["step-2"],
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

  it("toggles a pinned mapping from the Map button", () => {
    const onMap = vi.fn();
    render(
      <Sidecar events={events} onDismiss={() => undefined} onMap={onMap} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /map/i }));
    expect(onMap).toHaveBeenLastCalledWith([
      {
        anchorId: "force",
        label: "applied force",
        region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
        workedStepIds: ["step-1"],
      },
      {
        anchorId: "moment-center",
        label: "moment center",
        region: { x: 0.08, y: 0.42, width: 0.12, height: 0.18 },
        workedStepIds: ["step-2"],
      },
    ]);

    fireEvent.mouseEnter(
      screen.getByText("Take moments about A.").closest("li")!,
    );
    fireEvent.mouseLeave(screen.getByText("Take moments about A.").closest("li")!);
    expect(onMap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /map/i }));
    expect(onMap).toHaveBeenLastCalledWith([]);
  });

  it("highlights only the original anchor linked to the hovered step", () => {
    const onMap = vi.fn();
    render(
      <Sidecar events={events} onDismiss={() => undefined} onMap={onMap} />,
    );

    fireEvent.mouseEnter(
      screen.getByText("Take moments about A.").closest("li")!,
    );

    expect(onMap).toHaveBeenLastCalledWith([
      {
        anchorId: "force",
        label: "applied force",
        region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
        workedStepIds: ["step-1"],
      },
    ]);
  });
});
