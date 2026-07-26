import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PrecedentStore } from "./precedents.js";
import { TelemetryStore } from "./telemetry.js";
import { PersistentRollingTwinBudget } from "./twin-budget.js";

const databasePath = (): string =>
  join(mkdtempSync(join(tmpdir(), "parallel-readiness-")), "parallel.sqlite");

describe("desktop store readiness", () => {
  it("TelemetryStore readiness executes a live SQLite query", () => {
    const store = new TelemetryStore(databasePath());
    expect(() => store.assertReady()).not.toThrow();

    store.close();
    expect(() => store.assertReady()).toThrow();
  });

  it("PrecedentStore readiness executes a live SQLite query", () => {
    const store = new PrecedentStore(databasePath());
    expect(() => store.assertReady()).not.toThrow();

    store.close();
    expect(() => store.assertReady()).toThrow();
  });

  it("PersistentRollingTwinBudget readiness executes a live SQLite query", () => {
    const store = new PersistentRollingTwinBudget(databasePath());
    expect(() => store.assertReady()).not.toThrow();

    store.close();
    expect(() => store.assertReady()).toThrow();
  });
});
