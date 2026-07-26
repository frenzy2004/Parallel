import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export function resolveDesktopSqliteBinding(desktopRoot) {
  const desktopRequire = createRequire(join(desktopRoot, "package.json"));
  const packageJson = desktopRequire.resolve("better-sqlite3/package.json");
  return join(
    dirname(packageJson),
    "build",
    "Release",
    "better_sqlite3.node",
  );
}
