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
  recordPrecedentFeedback,
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
      twinAnchorId: "moment-center",
      originalAnchorId: "moment-center",
      label: "moment center",
      workedStepIds: ["moment"],
    },
    {
      twinAnchorId: "force-line",
      originalAnchorId: "force-line",
      label: "force line",
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
    expect(JSON.stringify(row)).not.toContain("originalAnchorRegions");
    expect(JSON.stringify(row)).not.toContain('"x":0.08');
  });

  it("does not reopen a legacy metadata-only row without a verified twin or shape fingerprint", () => {
    const databasePath = createDatabasePath();
    const initialStore = new PrecedentStore(databasePath);
    initialStore.close();
    const { originalAnchorRegions: _transient, ...legacySignature } = signature;
    const database = new Database(databasePath);
    database
      .prepare(
        `INSERT INTO precedents (
          signature_hash, signature_json, pattern_id, mapping_summary,
          twin_style, outcome, later_transfer_outcome, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "sha256:legacy",
        JSON.stringify(legacySignature),
        signature.patternId,
        "force ↔ force",
        "moment_about_point:sign-bracket",
        "unlocked",
        null,
        "2026-07-26T00:00:00.000Z",
      );
    database.close();

    const store = new PrecedentStore(databasePath);
    expect(store.matchPrecedent(signature)).toBeNull();
    store.close();
  });

  it("reopens the prior verified twin only for the same high-confidence shape fingerprint", () => {
    const store = new PrecedentStore(createDatabasePath());
    save(store);

    const match = store.matchPrecedent(signature);
    expect(match?.score).toBeGreaterThanOrEqual(0.92);
    expect(match?.twin).toEqual(twin);

    const movedDiagram = {
      ...signature,
      confidence: 0.99,
      originalAnchorRegions: signature.originalAnchorRegions.map((anchor) => ({
        ...anchor,
        region: {
          ...anchor.region,
          x: Math.max(0, anchor.region.x - 0.07),
        },
      })),
    };
    const lowConfidence = {
      ...signature,
      confidence: 0.89,
    };

    expect(store.matchPrecedent(movedDiagram)).toBeNull();
    expect(store.matchPrecedent(lowConfidence)).toBeNull();
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

  it("invalidates the same shape even when recognition confidence changed", () => {
    const store = new PrecedentStore(createDatabasePath());
    save(store);

    recordPrecedentOutcome(
      store,
      { ...signature, confidence: 0.99 },
      twin,
      "another_twin",
    );

    expect(store.matchPrecedent(signature)).toBeNull();
    store.close();
  });

  it("invalidates the matched abstract precedent after Not same feedback", () => {
    const store = new PrecedentStore(createDatabasePath());
    save(store);
    expect(store.matchPrecedent(signature)).not.toBeNull();

    expect(recordPrecedentFeedback(store, signature, "not_same")).toBe(true);

    expect(store.matchPrecedent(signature)).toBeNull();
    store.close();
  });
});
