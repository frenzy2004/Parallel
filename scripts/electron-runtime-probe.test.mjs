import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ELECTRON_RUNTIME_READY_SENTINEL,
  ElectronRuntimeProbeError,
  runElectronRuntimeProbe,
} from "./lib/electron-runtime-probe.mjs";

const fixture = resolve("scripts/fixtures/electron-probe-child.mjs");

const runFixture = (mode, timeoutMs = 300) =>
  runElectronRuntimeProbe({
    command: process.execPath,
    args: [fixture, mode],
    env: {
      ...process.env,
      PARALLEL_TEST_READY_SENTINEL: ELECTRON_RUNTIME_READY_SENTINEL,
    },
    timeoutMs,
  });

const expectProbeFailure = async (promise, reason) => {
  await expect(promise).rejects.toMatchObject({
    name: ElectronRuntimeProbeError.name,
    reason,
  });
};

describe("Electron runtime probe", () => {
  it("accepts only an exact readiness line and stops the ready process", async () => {
    await expect(runFixture("ready")).resolves.toEqual({
      sentinel: ELECTRON_RUNTIME_READY_SENTINEL,
    });
  });

  it("fails promptly when Electron exits cleanly before readiness", async () => {
    await expectProbeFailure(runFixture("early-zero"), "early_exit");
  });

  it("fails when Electron exits nonzero", async () => {
    await expectProbeFailure(runFixture("nonzero"), "nonzero_exit");
  });

  it("fails on timeout and terminates a silent Electron process", async () => {
    await expectProbeFailure(runFixture("silent", 80), "timeout");
  });

  it("does not accept a line that merely contains the sentinel", async () => {
    await expectProbeFailure(runFixture("lookalike", 80), "timeout");
  });
});
