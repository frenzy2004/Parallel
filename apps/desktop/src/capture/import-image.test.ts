// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  locateImportedPreview,
  readImportedFile,
  validateImportedFile,
} from "./import-image.js";

const raster = (
  name = "problem.png",
  type = "image/png",
  bytes: BlobPart[] = ["problem"],
): File => new File(bytes, name, { type });

describe("private screenshot import", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])(
    "accepts exactly one non-empty %s screenshot",
    (type) => {
      const file = raster("problem", type);

      expect(validateImportedFile([file])).toBe(file);
    },
  );

  it("rejects no file and multiple files", () => {
    expect(() => validateImportedFile([])).toThrow(/one screenshot/i);
    expect(() =>
      validateImportedFile([raster("one.png"), raster("two.png")]),
    ).toThrow(/one screenshot/i);
  });

  it.each(["image/svg+xml", "text/plain", "application/pdf", ""])(
    "rejects the unsupported media type %s",
    (type) => {
      expect(() => validateImportedFile([raster("problem", type)])).toThrow(
        /PNG, JPEG, or WebP/i,
      );
    },
  );

  it("rejects empty and over-8-MiB screenshots before reading them", () => {
    expect(() =>
      validateImportedFile([raster("empty.png", "image/png", [])]),
    ).toThrow(/empty/i);
    expect(() =>
      validateImportedFile([
        raster(
          "huge.png",
          "image/png",
          [new Uint8Array(8 * 1_024 * 1_024 + 1)],
        ),
      ]),
    ).toThrow(/8 MiB/i);
  });

  it("reads the chosen screenshot as an in-memory raster data URL", async () => {
    await expect(readImportedFile(raster())).resolves.toBe(
      "data:image/png;base64,cHJvYmxlbQ==",
    );
  });

  it("surfaces a browser read failure without exposing a path", async () => {
    const OriginalFileReader = globalThis.FileReader;
    class FailingFileReader {
      result: string | ArrayBuffer | null = null;
      error = new DOMException("unreadable");
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      readAsDataURL(): void {
        this.onerror?.();
      }
    }
    vi.stubGlobal("FileReader", FailingFileReader);

    await expect(readImportedFile(raster())).rejects.toThrow(
      /could not read/i,
    );
    expect(globalThis.FileReader).not.toBe(OriginalFileReader);
    vi.unstubAllGlobals();
  });

  it("maps the visible preview to its real screen rectangle", () => {
    expect(
      locateImportedPreview(
        { x: 24.4, y: 96.2, width: 411.7, height: 308.8 },
        { x: 300, y: 120 },
      ),
    ).toEqual({ x: 324, y: 216, width: 412, height: 309 });
  });

  it("rejects non-finite or empty preview geometry", () => {
    expect(() =>
      locateImportedPreview(
        { x: 0, y: 0, width: 0, height: 1_200 },
        { x: 0, y: 0 },
      ),
    ).toThrow(/dimensions/i);
    expect(() =>
      locateImportedPreview(
        { x: 0, y: 0, width: Number.NaN, height: 1_200 },
        { x: 0, y: 0 },
      ),
    ).toThrow(/dimensions/i);
  });
});
