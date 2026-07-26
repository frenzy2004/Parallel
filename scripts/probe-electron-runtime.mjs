import { resolve } from "node:path";
import {
  ElectronRuntimeProbeError,
  runElectronRuntimeProbe,
} from "./lib/electron-runtime-probe.mjs";

try {
  await runElectronRuntimeProbe({
    command: resolve("node_modules/.bin/electron"),
    args: [resolve("apps/desktop")],
  });
  console.log("electron_runtime_probe status=passed sqlite_native_load=passed");
} catch (error) {
  const reason =
    error instanceof ElectronRuntimeProbeError ? error.reason : "unknown";
  console.error(`electron_runtime_probe status=failed reason=${reason}`);
  process.exit(1);
}
