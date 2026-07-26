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

  it("toggles a pinned mapping from the Map button", () => {
    const onMap = vi.fn();
    render(
      <Sidecar events={events} onDismiss={() => undefined} onMap={onMap} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /map/i }));
    expect(onMap).toHaveBeenLastCalledWith(["force"]);

    fireEvent.mouseLeave(screen.getByText("Take moments about A.").closest("li")!);
    expect(onMap).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /map/i }));
    expect(onMap).toHaveBeenLastCalledWith([]);
  });

  it("requests a real regeneration from the active session", () => {
    const onAnother = vi.fn();
    render(
      <Sidecar
        events={events}
        onDismiss={() => undefined}
        onAnother={onAnother}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    fireEvent.keyDown(window, { key: "n" });

    expect(onAnother).toHaveBeenCalledTimes(2);
  });

  it("shows a matched Personal Precedent and accepts Not same feedback", () => {
    const onPrecedentFeedback = vi.fn();
    render(
      <Sidecar
        events={[recognizedEvent]}
        onDismiss={() => undefined}
        precedentMatch={{
          score: 0.96,
          precedent: {
            signatureHash: "sha256:precedent",
            patternId: "moment_about_point",
            mappingSummary: "bracket force ↔ original force",
            twinStyle: "moment_about_point:sign-bracket",
            outcome: "unlocked",
            laterTransferOutcome: null,
            createdAt: "2026-07-26T08:00:00.000Z",
          },
        }}
        onPrecedentFeedback={onPrecedentFeedback}
      />,
    );

    expect(screen.getByText("Same shape")).toBeInTheDocument();
    expect(
      screen.getByText("bracket force ↔ original force"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /not same/i }));
    expect(onPrecedentFeedback).toHaveBeenCalledOnce();
  });
});
