import { describe, expect, it } from "vitest";
import { chooseSidecarBounds } from "./window-placement.js";

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
});
