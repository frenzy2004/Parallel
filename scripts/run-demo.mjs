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

const demoEnvironment = { ...process.env };
for (const liveSetting of [
  "OPENAI_API_KEY",
  "EXA_API_KEY",
  "OPENAI_RECOGNITION_MODEL",
]) {
  delete demoEnvironment[liveSetting];
}

const electron = spawn(
  resolve("apps/desktop/node_modules/.bin/electron"),
  [resolve("apps/desktop")],
  {
    stdio: "inherit",
    env: { ...demoEnvironment, PARALLEL_DEMO_MODE: "1" },
  },
);
electron.on("exit", (code) => process.exit(code ?? 0));
