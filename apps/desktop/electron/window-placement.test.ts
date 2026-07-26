import { describe, expect, it } from "vitest";
import {
  chooseSidecarBounds,
  projectNormalizedHighlights,
} from "./window-placement.js";

const display = { x: 0, y: 0, width: 1440, height: 900 };
const sidecar = { width: 380, height: 520 };

describe("sidecar window placement", () => {
  it("chooses the right side when it fits", () => {
    expect(
      chooseSidecarBounds(
        { x: 100, y: 120, width: 500, height: 300 },
        display,
        sidecar,
      ),
    ).toMatchObject({ x: 616, y: 120, placement: "right" });
  });

  it("chooses the left side when right would leave the display", () => {
    expect(
      chooseSidecarBounds(
        { x: 900, y: 120, width: 500, height: 300 },
        display,
        sidecar,
      ),
    ).toMatchObject({ x: 504, y: 120, placement: "left" });
  });

  it("chooses below when neither horizontal side fits", () => {
    const result = chooseSidecarBounds(
      { x: 300, y: 120, width: 840, height: 200 },
      display,
      sidecar,
    );
    expect(result).toMatchObject({ x: 530, y: 336, placement: "below" });
    expect(result.y).toBeGreaterThanOrEqual(320);
  });

  it("projects distinct normalized anchor regions into display coordinates", () => {
    expect(
      projectNormalizedHighlights(
        [
          {
            anchorId: "moment-center",
            label: "moment center",
            region: { x: 0.1, y: 0.2, width: 0.2, height: 0.25 },
          },
          {
            anchorId: "force-line",
            label: "force line",
            region: { x: 0.65, y: 0.1, width: 0.15, height: 0.7 },
          },
        ],
        { x: 200, y: 100, width: 400, height: 300 },
        { x: 100, y: 50, width: 1200, height: 800 },
      ),
    ).toEqual([
      {
        x: 140,
        y: 110,
        width: 80,
        height: 75,
        label: "moment center",
      },
      {
        x: 360,
        y: 80,
        width: 60,
        height: 210,
        label: "force line",
      },
    ]);
  });
});
