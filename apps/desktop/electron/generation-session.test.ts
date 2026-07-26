import { describe, expect, it, vi } from "vitest";
import {
  captureModeForScreenAccess,
  GenerationSession,
  dismissOverlayState,
  runGuarded,
} from "./generation-session.js";

const crop = "data:image/png;base64,aGVsbG8=";

describe("generation lifecycle", () => {
  it("invalidates an in-flight generation and clears its crop on dismissal", () => {
    const session = new GenerationSession();
    const lease = session.begin(crop);
    expect(session.canDeliver(lease)).toBe(true);
    expect(session.cropForRegeneration()).toBe(crop);

    session.invalidate();

    expect(lease.signal.aborted).toBe(true);
    expect(session.canDeliver(lease)).toBe(false);
    expect(session.cropForRegeneration()).toBeNull();
  });

  it("prevents the previous generation from delivering after regeneration", () => {
    const session = new GenerationSession();
    const first = session.begin(crop);
    const second = session.begin(crop);

    expect(first.signal.aborted).toBe(true);
    expect(session.canDeliver(first)).toBe(false);
    expect(session.canDeliver(second)).toBe(true);
  });

  it("closes every live overlay window while invalidating private state", () => {
    const session = new GenerationSession();
    const lease = session.begin(crop);
    const first = { isDestroyed: () => false, close: vi.fn() };
    const second = { isDestroyed: () => false, close: vi.fn() };
    const alreadyClosed = { isDestroyed: () => true, close: vi.fn() };

    dismissOverlayState(session, [first, second, alreadyClosed]);

    expect(first.close).toHaveBeenCalledOnce();
    expect(second.close).toHaveBeenCalledOnce();
    expect(alreadyClosed.close).not.toHaveBeenCalled();
    expect(session.canDeliver(lease)).toBe(false);
    expect(session.cropForRegeneration()).toBeNull();
  });
});

describe("recoverable desktop failures", () => {
  it("uses instant lasso only when Screen Recording is granted", () => {
    expect(captureModeForScreenAccess("granted")).toBe("lasso");
  });

  it.each(["denied", "restricted", "not-determined", "unknown"])(
    "uses private screenshot import for Screen Recording status %s",
    (status) => {
      expect(captureModeForScreenAccess(status)).toBe("import");
    },
  );

  it("turns rejected async work into a handled recovery path", async () => {
    const onFailure = vi.fn();

    await expect(
      runGuarded(
        async () => {
          throw new Error("hotkey unavailable");
        },
        onFailure,
      ),
    ).resolves.toBeUndefined();
    expect(onFailure).toHaveBeenCalledWith(
      expect.objectContaining({ message: "hotkey unavailable" }),
    );
  });
});
