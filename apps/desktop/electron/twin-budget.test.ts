import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  DesktopTwinBudgetAuthority,
  PersistentRollingTwinBudget,
  ROLLING_MONTH_MS,
} from "./twin-budget.js";

const temporaryDirectories: string[] = [];

const createDatabasePath = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "parallel-budget-"));
  temporaryDirectories.push(directory);
  return join(directory, "parallel.sqlite");
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("persistent Electron paid-recognition budget", () => {
  it("persists a consumed slot across process restart", () => {
    const databasePath = createDatabasePath();
    const first = new PersistentRollingTwinBudget(databasePath, {
      limit: 1,
      now: () => 1_000_000,
    });

    expect(first.tryConsumeFreshRecognition()).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    first.close();

    const restarted = new PersistentRollingTwinBudget(databasePath, {
      limit: 1,
      now: () => 1_000_001,
    });
    expect(restarted.tryConsumeFreshRecognition()).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    restarted.close();
  });

  it("allows exactly 100 fresh live recognitions, then refuses", () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      now: () => 2_000_000,
    });

    for (let index = 0; index < 100; index += 1) {
      expect(budget.tryConsumeFreshRecognition().allowed).toBe(true);
    }
    expect(budget.tryConsumeFreshRecognition()).toMatchObject({
      allowed: false,
      remaining: 0,
    });
    budget.close();
  });

  it("makes a slot available only after its rolling-month window expires", () => {
    let now = 3_000_000;
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => now,
    });

    expect(budget.tryConsumeFreshRecognition().allowed).toBe(true);
    now += ROLLING_MONTH_MS;
    expect(budget.tryConsumeFreshRecognition().allowed).toBe(false);
    now += 1;
    expect(budget.tryConsumeFreshRecognition()).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    budget.close();
  });

  it("does not charge abstract N regeneration", () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => 4_000_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);

    expect(
      authority.authorizeFreshRecognition({
        OPENAI_API_KEY: "configured-live-key",
      }),
    ).toMatchObject({ allowed: true, charged: true, remaining: 0 });
    expect(authority.authorizeRegeneration()).toMatchObject({
      allowed: true,
      charged: false,
      remaining: 0,
    });
    expect(
      authority.authorizeFreshRecognition({
        OPENAI_API_KEY: "configured-live-key",
      }),
    ).toMatchObject({ allowed: false, charged: false, remaining: 0 });
    budget.close();
  });

  it("refuses before invoking fresh live recognition work", async () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => 4_500_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);
    let paidRecognitionCalls = 0;
    const runPaidRecognition = async (): Promise<string> => {
      paidRecognitionCalls += 1;
      return "started";
    };

    await expect(
      authority.runFreshRecognition(
        { OPENAI_API_KEY: "configured-live-key" },
        runPaidRecognition,
      ),
    ).resolves.toMatchObject({
      started: true,
      value: "started",
      decision: { allowed: true, charged: true },
    });
    await expect(
      authority.runFreshRecognition(
        { OPENAI_API_KEY: "configured-live-key" },
        runPaidRecognition,
      ),
    ).resolves.toMatchObject({
      started: false,
      decision: { allowed: false, charged: false },
    });
    expect(paidRecognitionCalls).toBe(1);
    budget.close();
  });

  it("charges every non-empty key exactly as the provider factory treats it", () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => 4_550_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);

    expect(
      authority.authorizeFreshRecognition({ OPENAI_API_KEY: " " }),
    ).toMatchObject({ allowed: true, charged: true, remaining: 0 });
    expect(
      authority.authorizeFreshRecognition({ OPENAI_API_KEY: " " }),
    ).toMatchObject({ allowed: false, charged: false, remaining: 0 });
    budget.close();
  });

  it("does not charge explicit offline demo mode even when the shell has a key", () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => 4_575_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);

    expect(
      authority.authorizeFreshRecognition({
        PARALLEL_DEMO_MODE: "1",
        OPENAI_API_KEY: "inherited-but-unused",
      }),
    ).toMatchObject({ allowed: true, charged: false, remaining: 1 });
    expect(
      authority.authorizeFreshRecognition({
        OPENAI_API_KEY: "configured-live-key",
      }),
    ).toMatchObject({ allowed: true, charged: true, remaining: 0 });
    budget.close();
  });

  it("runs abstract regeneration without consuming a paid slot", async () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => 4_600_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);

    await expect(
      authority.runRegeneration(async () => "next-variation"),
    ).resolves.toEqual({
      decision: { allowed: true, charged: false, remaining: 1 },
      value: "next-variation",
    });
    expect(
      authority.authorizeFreshRecognition({
        OPENAI_API_KEY: "configured-live-key",
      }),
    ).toMatchObject({ allowed: true, charged: true, remaining: 0 });
    budget.close();
  });

  it("releases the reserved slot only when main confirms a validated stored-twin reopen", async () => {
    const budget = new PersistentRollingTwinBudget(createDatabasePath(), {
      limit: 1,
      now: () => 5_000_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);

    await expect(
      authority.runFreshRecognition(
        { OPENAI_API_KEY: "configured-live-key" },
        async ({ releaseForValidatedPrecedentMatch }) => {
          expect(releaseForValidatedPrecedentMatch()).toBe(true);
          expect(releaseForValidatedPrecedentMatch()).toBe(false);
          return "stored-twin-replayed";
        },
      ),
    ).resolves.toEqual({
      started: true,
      decision: { allowed: true, charged: false, remaining: 1 },
      value: "stored-twin-replayed",
    });
    expect(
      authority.authorizeFreshRecognition({
        OPENAI_API_KEY: "configured-live-key",
      }),
    ).toMatchObject({ allowed: true, charged: true, remaining: 0 });

    budget.close();
  });

  it("persists timestamps only, never credentials or screenshot content", () => {
    const databasePath = createDatabasePath();
    const budget = new PersistentRollingTwinBudget(databasePath, {
      limit: 1,
      now: () => 7_000_000,
    });
    const authority = new DesktopTwinBudgetAuthority(budget);

    authority.authorizeFreshRecognition({
      OPENAI_API_KEY: "sk-do-not-persist",
      EXA_API_KEY: "exa-do-not-persist",
      PARALLEL_PRIVATE_CROP: "data:image/png;base64,cHJpdmF0ZQ==",
    });
    budget.close();

    const database = new Database(databasePath, { readonly: true });
    const columns = database
      .prepare("PRAGMA table_info(twin_budget_events)")
      .all()
      .map((column) => (column as { name: string }).name);
    const rows = database.prepare("SELECT * FROM twin_budget_events").all();
    database.close();

    expect(columns).toEqual(["id", "consumed_at"]);
    expect(JSON.stringify(rows)).toBe('[{"id":1,"consumed_at":7000000}]');
  });
});
