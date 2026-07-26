import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import type {
  PrecedentOutcome,
  StructuralSignature,
  TwinRender,
} from "@parallel/contracts";
import {
  PrecedentStore,
  recordPrecedentOutcome,
} from "./precedents.js";

const temporaryDirectories: string[] = [];

const createDatabasePath = (): string => {
  const directory = mkdtempSync(join(tmpdir(), "parallel-precedents-"));
  temporaryDirectories.push(directory);
  return join(directory, "precedents.sqlite");
};

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

const signature: StructuralSignature = {
  domain: "statics_2d",
  patternId: "moment_about_point",
  entities: ["force", "moment center", "lever arm"],
  relationships: ["force is offset from moment center"],
  constraints: ["counter-clockwise positive"],
  goal: "determine signed moment",
  invariant: "M = Fd perpendicular",
  courseConvention: "counter-clockwise positive",
  missingContext: [],
  confidence: 0.98,
  exaQuery: "introductory 2D statics moment about point worked example",
  originalAnchorRegions: [
    {
      anchorId: "moment-center",
      region: { x: 0.08, y: 0.42, width: 0.12, height: 0.18 },
    },
    {
      anchorId: "force-line",
      region: { x: 0.68, y: 0.18, width: 0.16, height: 0.5 },
    },
  ],
};

const twin: TwinRender = {
  patternId: "moment_about_point",
  twinStatement: "A sign bracket carries an offset force.",
  workedSteps: [
    {
      id: "moment",
      explanation: "Take moments about the pin.",
      expression: "ΣM_A = 0",
    },
  ],
  mappingEdges: [
    {
      twinAnchorId: "force",
      originalAnchorId: "force",
      label: "applied force",
      workedStepIds: ["moment"],
    },
  ],
  sourceRefs: [],
  difficultyDelta: 0,
  answerLeak: false,
  confidence: 0.98,
  rejectionReason: null,
};

const save = (
  store: PrecedentStore,
  outcome: PrecedentOutcome = "unlocked",
): void => {
  store.savePrecedent({
    signature,
    twin,
    outcome,
    cropDataUrl: "data:image/png;base64,c2VjcmV0",
    rawOcr: "student name and original work",
  } as never);
};

describe("Personal Precedents", () => {
  it("never writes screenshot bytes or raw OCR into SQLite", () => {
    const databasePath = createDatabasePath();
    const store = new PrecedentStore(databasePath);
    save(store);
    store.close();

    const database = new Database(databasePath, { readonly: true });
    const columns = database
      .prepare("PRAGMA table_info(precedents)")
      .all()
      .map((column) => (column as { name: string }).name);
    const row = database.prepare("SELECT * FROM precedents").get();
    database.close();

    expect(columns).not.toContain("crop_data_url");
    expect(columns).not.toContain("raw_ocr");
    expect(JSON.stringify(row)).not.toContain("c2VjcmV0");
    expect(JSON.stringify(row)).not.toContain("student name");
  });

  it("matches only when abstract similarity reaches 0.92", () => {
    const store = new PrecedentStore(createDatabasePath());
    save(store);

    const oneEntityChanged = {
      ...signature,
      entities: ["load", "moment center", "lever arm"],
    };
    const twoEntitiesChanged = {
      ...signature,
      entities: ["load", "pivot", "lever arm"],
    };

    expect(store.matchPrecedent(oneEntityChanged)?.score).toBeGreaterThanOrEqual(
      0.92,
    );
    expect(store.matchPrecedent(twoEntitiesChanged)).toBeNull();
    store.close();
  });

  it.each(["wrong_twin", "not_same"] as const)(
    "suppresses reuse after %s feedback",
    (outcome) => {
      const store = new PrecedentStore(createDatabasePath());
      save(store, outcome);

      expect(store.matchPrecedent(signature)).toBeNull();
      store.close();
    },
  );

  it("invalidates reuse when the student requests another twin", () => {
    const store = new PrecedentStore(createDatabasePath());
    save(store);
    expect(store.matchPrecedent(signature)).not.toBeNull();

    recordPrecedentOutcome(store, signature, twin, "another_twin");

    expect(store.matchPrecedent(signature)).toBeNull();
    store.close();
  });
});
