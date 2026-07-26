// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TwinEvent } from "@parallel/contracts/events";
import {
  SidecarSession,
  type SidecarSessionBridge,
} from "./SidecarSession.js";

afterEach(cleanup);

const recognized: TwinEvent = {
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

const complete: TwinEvent = {
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
        twinAnchorId: "bracket-force",
        originalAnchorId: "force-line",
        label: "applied force",
        workedStepIds: ["step-1"],
      },
      {
        twinAnchorId: "bracket-pin",
        originalAnchorId: "moment-center",
        label: "moment center",
        workedStepIds: ["step-1"],
      },
    ],
    sourceRefs: [],
    difficultyDelta: 0,
    answerLeak: false,
    confidence: 0.97,
    rejectionReason: null,
  },
};

const createBridge = (): {
  bridge: SidecarSessionBridge;
  emit(event: TwinEvent): void;
  reset(): void;
} => {
  let listener: ((event: unknown) => void) | null = null;
  let resetListener: (() => void) | null = null;
  const bridge: SidecarSessionBridge = {
    dismiss: vi.fn().mockResolvedValue(undefined),
    setMappingHighlights: vi.fn().mockResolvedValue(undefined),
    recordOutcome: vi.fn().mockResolvedValue(undefined),
    regenerateTwin: vi.fn().mockResolvedValue(undefined),
    matchPrecedent: vi.fn().mockResolvedValue({
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
    }),
    onTwinEvent: vi.fn((nextListener) => {
      listener = nextListener;
      return () => {
        listener = null;
      };
    }),
    onTwinReset: vi.fn((nextListener) => {
      resetListener = nextListener;
      return () => {
        resetListener = null;
      };
    }),
  };
  return {
    bridge,
    emit(event) {
      listener?.(event);
    },
    reset() {
      resetListener?.();
    },
  };
};

describe("SidecarSession", () => {
  it("queries and shows a Personal Precedent immediately after recognition", async () => {
    const { bridge, emit } = createBridge();
    render(<SidecarSession bridge={bridge} />);

    emit(recognized);

    await waitFor(() => expect(bridge.matchPrecedent).toHaveBeenCalledOnce());
    expect(
      await screen.findByText("Verified local shape match"),
    ).toBeInTheDocument();
    expect(screen.getByText("Prior twin reopened")).toBeInTheDocument();
    expect(
      screen.getByText("bracket force ↔ original force"),
    ).toBeInTheDocument();
  });

  it("regenerates from the active main-process session instead of logging only", async () => {
    const { bridge, emit } = createBridge();
    render(<SidecarSession bridge={bridge} />);
    emit(recognized);
    emit(complete);

    fireEvent.click(
      await screen.findByRole("button", { name: /regenerate/i }),
    );

    expect(bridge.regenerateTwin).toHaveBeenCalledOnce();
  });

  it("sends only authoritative anchor IDs across the privileged mapping IPC", async () => {
    const { bridge, emit } = createBridge();
    render(<SidecarSession bridge={bridge} />);
    emit(recognized);
    emit(complete);

    fireEvent.click(await screen.findByRole("button", { name: /map/i }));

    expect(bridge.setMappingHighlights).toHaveBeenCalledWith([
      "force-line",
      "moment-center",
    ]);
  });

  it("records Not same and removes the local precedent card", async () => {
    const { bridge, emit } = createBridge();
    render(<SidecarSession bridge={bridge} />);
    emit(recognized);

    fireEvent.click(
      await screen.findByRole("button", { name: /not same/i }),
    );

    await waitFor(() =>
      expect(bridge.recordOutcome).toHaveBeenCalledWith("not_same"),
    );
    expect(screen.queryByText("Same shape")).not.toBeInTheDocument();
  });

  it("does not show a stale precedent response after a session reset", async () => {
    let resolveMatch: ((value: unknown) => void) | undefined;
    const pendingMatch = new Promise<unknown>((resolve) => {
      resolveMatch = resolve;
    });
    const { bridge, emit, reset } = createBridge();
    bridge.matchPrecedent = vi.fn().mockReturnValue(pendingMatch);
    render(<SidecarSession bridge={bridge} />);

    emit(recognized);
    await waitFor(() => expect(bridge.matchPrecedent).toHaveBeenCalledOnce());
    reset();
    await act(async () => {
      resolveMatch?.({
        score: 0.96,
        precedent: {
          signatureHash: "sha256:stale",
          patternId: "moment_about_point",
          mappingSummary: "stale mapping",
          twinStyle: "moment_about_point:stale",
          outcome: "unlocked",
          laterTransferOutcome: null,
          createdAt: "2026-07-26T08:00:00.000Z",
        },
      });
      await pendingMatch;
    });
    bridge.matchPrecedent = vi.fn(
      () => new Promise<unknown>(() => undefined),
    );
    act(() => emit(recognized));

    expect(screen.queryByText("stale mapping")).not.toBeInTheDocument();
  });
});
