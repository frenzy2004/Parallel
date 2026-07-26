import { spawn } from "node:child_process";

export const ELECTRON_RUNTIME_READY_SENTINEL =
  "parallel_runtime_ready telemetry=ok precedents=ok";

export class ElectronRuntimeProbeError extends Error {
  constructor(reason) {
    super("Electron runtime probe failed");
    this.name = "ElectronRuntimeProbeError";
    this.reason = reason;
  }
}

const terminate = (child, signal) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
};

export const runElectronRuntimeProbe = ({
  command,
  args = [],
  cwd,
  env = process.env,
  timeoutMs = 8_000,
}) =>
  new Promise((resolveProbe, rejectProbe) => {
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      rejectProbe(new ElectronRuntimeProbeError("spawn_error"));
      return;
    }

    let stdoutBuffer = "";
    let ready = false;
    let terminationRequested = false;
    let pendingFailure = null;
    let settled = false;
    let timeoutTimer;
    let forceKillTimer;

    const clearTimers = () => {
      clearTimeout(timeoutTimer);
      if (forceKillTimer) clearTimeout(forceKillTimer);
    };

    const reject = (reason) => {
      if (settled) return;
      settled = true;
      clearTimers();
      rejectProbe(new ElectronRuntimeProbeError(reason));
    };

    const requestTermination = () => {
      if (terminationRequested) return;
      terminationRequested = true;
      terminate(child, "SIGTERM");
      forceKillTimer = setTimeout(() => terminate(child, "SIGKILL"), 500);
      forceKillTimer.unref?.();
    };

    const acceptLine = (line) => {
      if (
        settled ||
        ready ||
        line !== ELECTRON_RUNTIME_READY_SENTINEL
      ) {
        return;
      }
      ready = true;
      requestTermination();
    };

    child.once("error", () => reject("spawn_error"));
    child.once("exit", (code) => {
      if (settled) return;
      if (pendingFailure) {
        reject(pendingFailure);
        return;
      }
      if (!ready) {
        reject(code !== null && code !== 0 ? "nonzero_exit" : "early_exit");
        return;
      }
      if (code !== null && code !== 0) {
        reject("nonzero_exit");
        return;
      }
      settled = true;
      clearTimers();
      resolveProbe({ sentinel: ELECTRON_RUNTIME_READY_SENTINEL });
    });
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += String(chunk);
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) acceptLine(line);
    });
    child.stderr.resume();

    timeoutTimer = setTimeout(() => {
      pendingFailure = "timeout";
      requestTermination();
    }, timeoutMs);
  });
