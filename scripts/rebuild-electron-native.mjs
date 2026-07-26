import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const root = resolve(import.meta.dirname, "..");
const require = createRequire(import.meta.url);
const electronVersion = require(
  join(root, "node_modules", "electron", "package.json"),
).version;
const nodeBinding = join(
  root,
  "node_modules",
  "better-sqlite3",
  "build",
  "Release",
  "better_sqlite3.node",
);
if (!existsSync(nodeBinding)) {
  console.error("electron_native_build status=failed reason=node_binding_missing");
  process.exit(1);
}

const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "parallel-node-binding-"),
);
const savedNodeBinding = join(temporaryDirectory, "better_sqlite3.node");
const electronBinding = join(
  root,
  "apps",
  "desktop",
  "native",
  "better_sqlite3.node",
);
copyFileSync(nodeBinding, savedNodeBinding);

try {
  const rebuild = spawnSync(
    join(root, "node_modules", ".bin", "electron-rebuild"),
    [
      "--force",
      "--only",
      "better-sqlite3",
      "--version",
      electronVersion,
      "--module-dir",
      join(root, "apps", "desktop"),
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (rebuild.status !== 0 || !existsSync(nodeBinding)) {
    console.error("electron_native_build status=failed reason=rebuild");
    process.exitCode = 1;
  } else {
    mkdirSync(dirname(electronBinding), { recursive: true });
    copyFileSync(nodeBinding, electronBinding);
    console.log("electron_native_build status=passed");
  }
} finally {
  copyFileSync(savedNodeBinding, nodeBinding);
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
