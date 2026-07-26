// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { TwinEvent } from "@parallel/contracts/events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParallelWorkspace } from "./parallel-workspace";

const recognized: TwinEvent = {
  state: "recognized",
  label: "Moment about a point",
  signature: {
    domain: "statics_2d",
    patternId: "moment_about_point",
    entities: ["pin A", "position vector", "applied force"],
    relationships: ["the force acts at the end of the position vector"],
    constraints: ["counterclockwise moments are positive"],
    goal: "determine the signed moment about A",
    invariant: "M_A = r_x F_y - r_y F_x",
    courseConvention: "counterclockwise positive",
    missingContext: [],
    confidence: 0.94,
    exaQuery: "introductory statics moment about a point worked example",
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
    twinStatement:
      "A museum sign bracket carries a 180 N force at an offset point B.",
    workedSteps: [
      {
        id: "lever-arm",
        explanation: "Resolve the position vector and force into components.",
        expression: "r = ⟨2.08, 1.20⟩ m; F = ⟨137.89, −115.70⟩ N",
      },
      {
        id: "moment",
        explanation: "Evaluate the planar cross product about A.",
        expression: "M_A = r_x F_y − r_y F_x",
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
        twinAnchorId: "bracket-force",
        originalAnchorId: "force-line",
        label: "force direction",
        workedStepIds: ["lever-arm", "moment"],
      },
    ],
    sourceRefs: [
      {
        title: "Engineering Statics: Moments",
        url: "https://example.edu/statics/moments",
        highlight: "Moments in two dimensions use the planar cross product.",
      },
    ],
    difficultyDelta: 0,
    answerLeak: false,
    confidence: 0.92,
    rejectionReason: null,
  },
};

const successfulEvents = [recognized, complete];

const response = (events: TwinEvent[], extra: Record<string, unknown> = {}) =>
  ({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ events, ...extra }),
  }) as unknown as Response;

const chooseScreenshot = (name = "problem.png") => {
  const file = new File(["image bytes"], name, { type: "image/png" });
  fireEvent.change(screen.getByLabelText(/choose a screenshot/i), {
    target: { files: [file] },
  });
  return file;
};

describe("ParallelWorkspace", () => {
  beforeEach(() => {
    let objectUrlId = 0;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => `blob:parallel-${++objectUrlId}`),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects a screenshot that cannot fit through the Vercel request limit", () => {
    render(<ParallelWorkspace />);
    const oversized = new File(
      [new Uint8Array(4 * 1024 * 1024 + 1)],
      "retina.png",
      { type: "image/png" },
    );

    fireEvent.change(screen.getByLabelText(/choose a screenshot/i), {
      target: { files: [oversized] },
    });

    expect(screen.getByText(/smaller than 4 MB/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    ).toBeDisabled();
  });

  it("rejects a non-image before creating a local preview", () => {
    render(<ParallelWorkspace />);
    const textFile = new File(["not a screenshot"], "notes.txt", {
      type: "text/plain",
    });

    fireEvent.change(screen.getByLabelText(/choose a screenshot/i), {
      target: { files: [textFile] },
    });

    expect(
      screen.getByText(/choose a PNG, JPEG or WebP screenshot/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    ).toBeDisabled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("rejects a zero-byte image before creating a local preview", () => {
    render(<ParallelWorkspace />);
    const emptyImage = new File([], "empty.png", { type: "image/png" });

    fireEvent.change(screen.getByLabelText(/choose a screenshot/i), {
      target: { files: [emptyImage] },
    });

    expect(
      screen.getByText(/non-empty screenshot smaller than 4 MB/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    ).toBeDisabled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("keeps the bundled demo fixture-only even after a screenshot was selected", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        response(successfulEvents, {
          demo: {
            fixed: true,
            fixtureId: "moment-about-point-v1",
            notice: "No uploaded screenshot was analyzed.",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    render(<ParallelWorkspace />);
    chooseScreenshot("calculus.png");

    fireEvent.click(
      screen.getByRole("button", { name: /try bundled statics demo/i }),
    );

    expect(
      await screen.findByText(/bundled fixed demo — no screenshot analyzed/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /calculus\.png/i }),
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/demo");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      fixtureId: "moment-about-point-v1",
    });
    expect(init.body).not.toBeInstanceOf(FormData);
  });

  it("sends the selected image only through live analysis", async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(successfulEvents));
    vi.stubGlobal("fetch", fetchMock);
    render(<ParallelWorkspace />);
    const file = chooseScreenshot();

    fireEvent.click(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    );

    expect(
      await screen.findByText(/museum sign bracket carries/i),
    ).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/twins");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("crop")).toBe(file);
    expect(body.get("coursePackId")).toBe("statics-2d");
  });

  it("shows an honest unsupported response for a calculus screenshot", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      response([
        { state: "reading" },
        {
          state: "unsupported",
          reason:
            "This appears to be calculus (area under curves), not a 2D Statics problem.",
        },
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<ParallelWorkspace />);
    chooseScreenshot("area-under-curves.png");

    fireEvent.click(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    );

    expect(
      await screen.findByText(/appears to be calculus \(area under curves\)/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/nothing was invented/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/museum sign bracket carries/i),
    ).not.toBeInTheDocument();
  });

  it("renders an engine error as a failure, not as an unsupported topic", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response([
          { state: "reading" },
          { state: "error", message: "The verified compiler was unavailable." },
        ]),
      ),
    );
    render(<ParallelWorkspace />);
    chooseScreenshot();

    fireEvent.click(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    );

    expect(
      await screen.findByText(/verified compiler was unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Analysis failed", { selector: ".eyebrow" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/outside this course pack/i),
    ).not.toBeInTheDocument();
  });

  it("highlights only the original regions mapped to the active worked step", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(successfulEvents)));
    render(<ParallelWorkspace />);
    chooseScreenshot();
    fireEvent.click(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    );
    const positionStep = await screen.findByRole("button", {
      name: /resolve the position vector and force/i,
    });
    const forceStep = screen.getByRole("button", {
      name: /evaluate the planar cross product/i,
    });

    fireEvent.mouseEnter(positionStep);
    expect(screen.getAllByTestId("mapping-highlight")).toHaveLength(1);
    expect(screen.getByTestId("mapping-highlight")).toHaveAttribute(
      "data-anchor-id",
      "force-line",
    );

    fireEvent.mouseLeave(positionStep);
    expect(screen.queryByTestId("mapping-highlight")).not.toBeInTheDocument();

    fireEvent.focus(forceStep);
    expect(
      screen
        .getAllByTestId("mapping-highlight")
        .map((highlight) => highlight.getAttribute("data-anchor-id")),
    ).toEqual(["moment-center", "force-line"]);

    fireEvent.click(forceStep);
    fireEvent.blur(forceStep);
    expect(screen.getAllByTestId("mapping-highlight")).toHaveLength(2);
  });

  it("announces completion without placing interactive steps inside the live region", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(successfulEvents)));
    render(<ParallelWorkspace />);
    chooseScreenshot();
    fireEvent.click(
      screen.getByRole("button", { name: /analyze my screenshot/i }),
    );

    const step = await screen.findByRole("button", {
      name: /resolve the position vector and force/i,
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/twin complete/i);
    expect(status).not.toContainElement(step);
  });

  it("revokes replaced and unmounted local preview URLs", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const { unmount } = render(<ParallelWorkspace />);

    chooseScreenshot("first.png");
    chooseScreenshot("second.png");

    await waitFor(() =>
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:parallel-1"),
    );
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:parallel-2");
  });

  it("clears a previous twin before a new request resolves", async () => {
    let resolveSecond: ((value: Response) => void) | undefined;
    const secondResponse = new Promise<Response>((resolve) => {
      resolveSecond = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(successfulEvents))
      .mockReturnValueOnce(secondResponse);
    vi.stubGlobal("fetch", fetchMock);
    render(<ParallelWorkspace />);
    chooseScreenshot();
    const analyze = screen.getByRole("button", {
      name: /analyze my screenshot/i,
    });

    fireEvent.click(analyze);
    expect(
      await screen.findByText(/museum sign bracket carries/i),
    ).toBeInTheDocument();

    fireEvent.click(analyze);
    expect(
      screen.queryByText(/museum sign bracket carries/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/reading the structure/i)).toBeInTheDocument();

    await act(async () => {
      resolveSecond?.(
        response([
          {
            state: "unsupported",
            reason: "This topic is outside the current Statics course pack.",
          },
        ]),
      );
      await secondResponse;
    });

    expect(
      await screen.findByText(/outside the current statics course pack/i),
    ).toBeInTheDocument();
  });

  it("renders a recoverable API error without retaining an old result", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(successfulEvents))
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: vi.fn().mockResolvedValue({
          error: {
            code: "live_recognition_unavailable",
            message: "Live recognition is not configured yet.",
          },
        }),
      } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    render(<ParallelWorkspace />);
    chooseScreenshot();
    const analyze = screen.getByRole("button", {
      name: /analyze my screenshot/i,
    });
    fireEvent.click(analyze);
    expect(
      await screen.findByText(/museum sign bracket carries/i),
    ).toBeInTheDocument();

    fireEvent.click(analyze);

    expect(
      await screen.findByText(/live recognition is not configured yet/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/your screenshot stayed in this request/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/museum sign bracket carries/i),
    ).not.toBeInTheDocument();
  });
});
