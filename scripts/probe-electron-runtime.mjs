import { spawn } from "node:child_process";
import { resolve } from "node:path";

const child = spawn(
  resolve("node_modules/.bin/electron"),
  [resolve("apps/desktop")],
  { stdio: ["ignore", "pipe", "pipe"] },
);
let output = "";
child.stdout.on("data", (chunk) => {
  output += String(chunk);
});
child.stderr.on("data", (chunk) => {
  output += String(chunk);
});

await new Promise((resolveWait) => setTimeout(resolveWait, 2_000));
child.kill("SIGTERM");
await new Promise((resolveWait) => child.once("exit", resolveWait));

if (
  /App threw an error|SyntaxError|ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX|NODE_MODULE_VERSION|better_sqlite3\.node|Could not locate the bindings file|was compiled against a different Node\.js version/i.test(
    output,
  )
) {
  console.error("electron_runtime_probe status=failed");
  process.exit(1);
}
console.log("electron_runtime_probe status=passed sqlite_native_load=passed");
