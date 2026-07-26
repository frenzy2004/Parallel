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
        anchorId: "force-line",
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
    state: "twin_step",
    index: 1,
    step: {
      id: "step-2",
      explanation: "Resolve the applied-force contribution.",
      expression: "M_F = Fd",
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
        {
          id: "step-2",
          explanation: "Resolve the applied-force contribution.",
          expression: "M_F = Fd",
        },
      ],
      mappingEdges: [
        {
          twinAnchorId: "force",
          originalAnchorId: "force-line",
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
        anchorId: "force-line",
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
        anchorId: "force-line",
        label: "applied force",
        region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
        workedStepIds: ["step-1"],
      },
    ]);
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

  it("keeps teaching sources collapsed, then reveals title and domain without navigation", () => {
    const completed = events.at(-1);
    if (completed?.state !== "complete") {
      throw new Error("test fixture must end in a complete event");
    }
    const sourcedEvents: TwinEvent[] = [
      ...events.slice(0, -1),
      {
        ...completed,
        twin: {
          ...completed.twin,
          sourceRefs: [
            {
              title: "Engineering Statics — Moments",
              url: "https://engineeringstatics.org/Chapter_04-moments.html?student=private",
              highlight: "Moment concepts",
            },
          ],
        },
      },
    ];
    render(
      <Sidecar events={sourcedEvents} onDismiss={() => undefined} />,
    );

    const toggle = screen.getByRole("button", {
      name: /sources & confidence/i,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("97% structure confidence");
    expect(toggle).toHaveTextContent("1 teaching source");
    expect(
      screen.queryByText("Engineering Statics — Moments"),
    ).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("Engineering Statics — Moments"),
    ).toBeInTheDocument();
    expect(screen.getByText("engineeringstatics.org")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText(/student=private/i)).not.toBeInTheDocument();
  });

  it("labels teaching sources unavailable without lowering structural confidence", () => {
    render(<Sidecar events={events} onDismiss={() => undefined} />);

    const toggle = screen.getByRole("button", {
      name: /sources & confidence/i,
    });
    expect(toggle).toHaveTextContent("97% structure confidence");
    expect(toggle).toHaveTextContent("sources unavailable");

    fireEvent.click(toggle);

    expect(
      screen.getByText(
        "Teaching sources are unavailable. The worked twin is still verified locally.",
      ),
    ).toBeInTheDocument();
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

    expect(
      screen.getByText("Verified local shape match"),
    ).toBeInTheDocument();
    expect(screen.getByText("Prior twin reopened")).toBeInTheDocument();
    expect(screen.queryByText(/96%/)).not.toBeInTheDocument();
    expect(
      screen.getByText("bracket force ↔ original force"),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /not same/i }));
    expect(onPrecedentFeedback).toHaveBeenCalledOnce();
  });
});
