import { describe, expect, it } from "vitest";
import {
  assertTrustedIpcSender,
  isTrustedRendererDocumentUrl,
  resolveRendererSource,
  validateAnchorIds,
  validateCropPayload,
  validateNoPayload,
  validateOutcome,
  validateSinglePayload,
} from "./runtime-guard.js";

const rendererFile = "/Applications/PARALLEL/dist/index.html";
const display = { x: 100, y: 50, width: 1_440, height: 900 };
const cropDataUrl = "data:image/png;base64,aGVsbG8=";

describe("renderer source policy", () => {
  it("uses the packaged file when no development URL is configured", () => {
    expect(resolveRendererSource(undefined, rendererFile)).toEqual({
      kind: "file",
      rendererFile,
    });
  });

  it.each([
    "http://localhost:5173",
    "http://127.0.0.1:4173/",
    "http://[::1]:3000",
  ])("allows the explicit loopback development origin %s", (configuredUrl) => {
    expect(resolveRendererSource(configuredUrl, rendererFile)).toMatchObject({
      kind: "development",
      origin: expect.stringMatching(/^http:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d+$/),
    });
  });

  it.each([
    "https://parallel.example",
    "http://localhost.evil.example:5173",
    "file:///tmp/untrusted.html",
    "http://user:password@localhost:5173",
    "http://localhost:5173/untrusted/path",
    "http://localhost:5173?redirect=https://evil.example",
    "javascript:alert(1)",
  ])("rejects an untrusted development renderer URL: %s", (configuredUrl) => {
    expect(() => resolveRendererSource(configuredUrl, rendererFile)).toThrow(
      /localhost|renderer/i,
    );
  });

  it("trusts only the configured document and its view query", () => {
    const source = resolveRendererSource(undefined, rendererFile);
    expect(
      isTrustedRendererDocumentUrl(
        "file:///Applications/PARALLEL/dist/index.html?view=sidecar",
        source,
      ),
    ).toBe(true);
    expect(
      isTrustedRendererDocumentUrl(
        "file:///Applications/PARALLEL/dist/other.html?view=sidecar",
        source,
      ),
    ).toBe(false);

    const development = resolveRendererSource(
      "http://localhost:5173",
      rendererFile,
    );
    expect(
      isTrustedRendererDocumentUrl(
        "http://localhost:5173/?view=capture",
        development,
      ),
    ).toBe(true);
    expect(
      isTrustedRendererDocumentUrl(
        "http://localhost.evil.example:5173/?view=capture",
        development,
      ),
    ).toBe(false);
  });
});

describe("privileged IPC boundary", () => {
  const source = resolveRendererSource(undefined, rendererFile);

  it("requires both the expected web contents and trusted document URL", () => {
    expect(() =>
      assertTrustedIpcSender(
        {
          senderId: 7,
          senderUrl:
            "file:///Applications/PARALLEL/dist/index.html?view=capture",
        },
        7,
        source,
      ),
    ).not.toThrow();
    expect(() =>
      assertTrustedIpcSender(
        {
          senderId: 8,
          senderUrl:
            "file:///Applications/PARALLEL/dist/index.html?view=capture",
        },
        7,
        source,
      ),
    ).toThrow(/sender/i);
    expect(() =>
      assertTrustedIpcSender(
        {
          senderId: 7,
          senderUrl: "https://evil.example/?view=capture",
        },
        7,
        source,
      ),
    ).toThrow(/sender/i);
  });

  it("enforces exact IPC argument counts", () => {
    expect(() => validateNoPayload([])).not.toThrow();
    expect(() => validateNoPayload(["unexpected"])).toThrow(/payload/i);
    expect(validateSinglePayload(["value"])).toBe("value");
    expect(() => validateSinglePayload([])).toThrow(/payload/i);
    expect(() => validateSinglePayload(["one", "two"])).toThrow(/payload/i);
  });

  it("accepts a bounded raster crop wholly inside the active display", () => {
    expect(
      validateCropPayload(
        {
          cropDataUrl,
          bounds: { x: 120, y: 80, width: 500, height: 320 },
        },
        display,
      ),
    ).toEqual({
      cropDataUrl,
      bounds: { x: 120, y: 80, width: 500, height: 320 },
    });
  });

  it.each([
    {
      cropDataUrl: "data:image/svg+xml;base64,PHN2Zz4=",
      bounds: { x: 120, y: 80, width: 500, height: 320 },
    },
    {
      cropDataUrl: "data:image/png;base64,not base64",
      bounds: { x: 120, y: 80, width: 500, height: 320 },
    },
    {
      cropDataUrl,
      bounds: { x: 50, y: 80, width: 500, height: 320 },
    },
    {
      cropDataUrl,
      bounds: { x: 120, y: 80, width: Number.NaN, height: 320 },
    },
    {
      cropDataUrl,
      bounds: { x: 120, y: 80, width: 0, height: 320 },
    },
  ])("rejects malformed or out-of-display crop payloads", (payload) => {
    expect(() => validateCropPayload(payload, display)).toThrow(/crop/i);
  });

  it("rejects crop bytes above the fixed in-memory limit", () => {
    const oversized = `data:image/png;base64,${"A".repeat(12_000_000)}`;
    expect(() =>
      validateCropPayload(
        {
          cropDataUrl: oversized,
          bounds: { x: 120, y: 80, width: 500, height: 320 },
        },
        display,
      ),
    ).toThrow(/crop/i);
  });

  it("accepts only active, well-formed mapping anchors", () => {
    expect(validateAnchorIds(["force", "point-A"], ["force", "point-A"])).toEqual(
      ["force", "point-A"],
    );
    expect(() =>
      validateAnchorIds(["force", "unrecognized"], ["force"]),
    ).toThrow(/anchor/i);
    expect(() => validateAnchorIds("force", ["force"])).toThrow(/anchor/i);
    expect(() => validateAnchorIds(["<script>"], ["<script>"])).toThrow(
      /anchor/i,
    );
  });

  it.each(["unlocked", "wrong_twin", "another_twin", "not_same"] as const)(
    "accepts the renderer outcome %s",
    (outcome) => {
      expect(validateOutcome(outcome)).toBe(outcome);
    },
  );

  it("rejects unsupported outcome payloads", () => {
    expect(() => validateOutcome("dismissed")).toThrow(/outcome/i);
    expect(() => validateOutcome({ outcome: "unlocked" })).toThrow(/outcome/i);
  });
});
