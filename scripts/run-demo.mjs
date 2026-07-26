import { spawn } from "node:child_process";
import { resolve } from "node:path";

if (process.platform !== "darwin") {
  console.error("PARALLEL demo currently supports macOS only.");
  process.exit(1);
}

const fixture = resolve("apps/desktop/demo/statics-problem.html");
const opened = spawn("open", [fixture], {
  detached: true,
  stdio: "ignore",
});
opened.unref();

const electron = spawn(
  resolve("node_modules/.bin/electron"),
  [resolve("apps/desktop")],
  {
    stdio: "inherit",
    env: { ...process.env, PARALLEL_DEMO_MODE: "1" },
  },
);
electron.on("exit", (code) => process.exit(code ?? 0));
