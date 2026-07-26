// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScreenshotImport } from "./ScreenshotImport.js";

const displayBounds = { x: 100, y: 50, width: 1_440, height: 900 };
const screenshot = (
  name = "problem.png",
  type = "image/png",
  contents = "problem",
): File => new File([contents], name, { type });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ScreenshotImport", () => {
  it("previews one chosen screenshot and submits its bounded in-memory crop", async () => {
    const onSubmit = vi.fn();
    render(
      <ScreenshotImport
        displayBounds={displayBounds}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
        onOpenScreenSettings={vi.fn()}
      />,
    );

    const input = screen.getByLabelText("Choose screenshot");
    expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
    fireEvent.change(input, { target: { files: [screenshot()] } });

    const preview = await screen.findByAltText("Selected problem screenshot");
    Object.defineProperties(preview, {
      naturalWidth: { value: 1_600 },
      naturalHeight: { value: 1_200 },
    });
    fireEvent.load(preview);
    fireEvent.click(screen.getByRole("button", { name: "Make twin" }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        "data:image/png;base64,cHJvYmxlbQ==",
        { x: 220, y: 50, width: 1_200, height: 900 },
      ),
    );
  });

  it.each([
    {
      action: "paste",
      dispatch: (file: File) =>
        fireEvent.paste(screen.getByRole("main"), {
          clipboardData: { files: [file] },
        }),
    },
    {
      action: "drop",
      dispatch: (file: File) =>
        fireEvent.drop(screen.getByTestId("screenshot-drop-zone"), {
          dataTransfer: { files: [file] },
        }),
    },
  ])("accepts a screenshot by $action", async ({ dispatch }) => {
    render(
      <ScreenshotImport
        displayBounds={displayBounds}
        onSubmit={vi.fn()}
        onDismiss={vi.fn()}
        onOpenScreenSettings={vi.fn()}
      />,
    );

    dispatch(screenshot());

    expect(
      await screen.findByAltText("Selected problem screenshot"),
    ).toBeInTheDocument();
  });

  it("keeps invalid or multiple files in the import view with an inline error", async () => {
    render(
      <ScreenshotImport
        displayBounds={displayBounds}
        onSubmit={vi.fn()}
        onDismiss={vi.fn()}
        onOpenScreenSettings={vi.fn()}
      />,
    );
    const input = screen.getByLabelText("Choose screenshot");

    fireEvent.change(input, {
      target: {
        files: [
          screenshot("problem.svg", "image/svg+xml", "<svg />"),
          screenshot("other.png"),
        ],
      },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /one screenshot/i,
    );
    expect(
      screen.queryByAltText("Selected problem screenshot"),
    ).not.toBeInTheDocument();

    fireEvent.change(input, {
      target: { files: [screenshot("problem.svg", "image/svg+xml", "<svg />")] },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /PNG, JPEG, or WebP/i,
    );
  });

  it("rejects bytes the browser cannot decode as a raster image", async () => {
    const onSubmit = vi.fn();
    render(
      <ScreenshotImport
        displayBounds={displayBounds}
        onSubmit={onSubmit}
        onDismiss={vi.fn()}
        onOpenScreenSettings={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Choose screenshot"), {
      target: {
        files: [screenshot("spoofed.png", "image/png", "not a real PNG")],
      },
    });

    const preview = await screen.findByAltText("Selected problem screenshot");
    fireEvent.error(preview);

    expect(await screen.findByRole("alert")).toHaveTextContent(/decode/i);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.queryByAltText("Selected problem screenshot"),
    ).not.toBeInTheDocument();
  });

  it("says permission is optional and exposes close and Settings actions", () => {
    const onDismiss = vi.fn();
    const onOpenScreenSettings = vi.fn();
    render(
      <ScreenshotImport
        displayBounds={displayBounds}
        onSubmit={vi.fn()}
        onDismiss={onDismiss}
        onOpenScreenSettings={onOpenScreenSettings}
      />,
    );

    expect(
      screen.getByText(
        "Screen Recording is optional. It only enables one-click lasso.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/never saves this screenshot/i)).toHaveTextContent(
      /configured AI provider/i,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Enable one-click lasso" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenScreenSettings).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("dismisses on Escape without reading or submitting a screenshot", () => {
    const onDismiss = vi.fn();
    const onSubmit = vi.fn();
    render(
      <ScreenshotImport
        displayBounds={displayBounds}
        onSubmit={onSubmit}
        onDismiss={onDismiss}
        onOpenScreenSettings={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
