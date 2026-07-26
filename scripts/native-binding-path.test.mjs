import { join, resolve } from "node:path";
import { realpathSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveDesktopSqliteBinding } from "./lib/native-binding-path.mjs";

describe("desktop native binding resolution", () => {
  it("targets the dependency resolved from the desktop workspace", () => {
    const root = resolve(import.meta.dirname, "..");
    const desktopRoot = join(root, "apps", "desktop");
    const binding = resolveDesktopSqliteBinding(desktopRoot);
    const expectedBinding = join(
      desktopRoot,
      "node_modules",
      "better-sqlite3",
      "build",
      "Release",
      "better_sqlite3.node",
    );

    expect(binding).toBe(realpathSync(expectedBinding));
  });
});
