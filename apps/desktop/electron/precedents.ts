import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import {
  PrecedentSchema,
  StructuralSignatureSchema,
  TwinRenderSchema,
  type Precedent,
  type PrecedentOutcome,
  type StructuralSignature,
  type TwinRender,
} from "@parallel/contracts";

export const PRECEDENT_MATCH_THRESHOLD = 0.92;

const AbstractSignatureSchema = StructuralSignatureSchema.omit({
  originalAnchorRegions: true,
});
type AbstractSignature = Omit<
  StructuralSignature,
  "originalAnchorRegions"
>;

interface SavePrecedentInput {
  signature: StructuralSignature;
  twin: TwinRender;
  outcome: PrecedentOutcome;
}

interface PrecedentRow {
  signature_hash: string;
  signature_json: string;
  shape_hash: string | null;
  twin_json: string | null;
  pattern_id: string;
  mapping_summary: string;
  twin_style: string;
  outcome: string;
  later_transfer_outcome: string | null;
  created_at: string;
}

export interface PrecedentMatch {
  precedent: Precedent;
  score: number;
  twin: TwinRender;
}

export class PrecedentStore {
  private readonly database: Database.Database;

  constructor(databasePath: string, nativeBinding?: string) {
    this.database = new Database(databasePath, {
      ...(nativeBinding ? { nativeBinding } : {}),
    });
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS precedents (
        signature_hash TEXT PRIMARY KEY,
        signature_json TEXT NOT NULL,
        shape_hash TEXT,
        twin_json TEXT,
        pattern_id TEXT NOT NULL,
        mapping_summary TEXT NOT NULL,
        twin_style TEXT NOT NULL,
        outcome TEXT NOT NULL,
        later_transfer_outcome TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS precedents_pattern_outcome
        ON precedents(pattern_id, outcome);
    `);
    this.ensureColumn("shape_hash", "TEXT");
    this.ensureColumn("twin_json", "TEXT");
  }

  savePrecedent(input: SavePrecedentInput): Precedent {
    const signature = StructuralSignatureSchema.parse(input.signature);
    const persistedSignature = toAbstractSignature(signature);
    const twin = TwinRenderSchema.parse(input.twin);
    const createdAt = new Date().toISOString();
    const shapeHash = shapeFingerprint(signature);
    const precedent = PrecedentSchema.parse({
      signatureHash: signatureHash(persistedSignature),
      patternId: signature.patternId,
      mappingSummary: twin.mappingEdges
        .map((edge) => `${edge.twinAnchorId} ↔ ${edge.originalAnchorId}`)
        .join("; "),
      twinStyle: `${signature.patternId}:${surfaceStyle(twin.twinStatement)}`,
      outcome: input.outcome,
      laterTransferOutcome: null,
      createdAt,
    });

    if (input.outcome !== "unlocked") {
      this.database
        .prepare(
          `UPDATE precedents
           SET outcome = ?, later_transfer_outcome = ?
           WHERE pattern_id = ? AND shape_hash = ?`,
        )
        .run(
          input.outcome,
          input.outcome,
          signature.patternId,
          shapeHash,
        );
    }

    this.database
      .prepare(
        `INSERT INTO precedents (
          signature_hash, signature_json, shape_hash, twin_json, pattern_id,
          mapping_summary, twin_style, outcome, later_transfer_outcome,
          created_at
        ) VALUES (
          @signatureHash, @signatureJson, @shapeHash, @twinJson, @patternId,
          @mappingSummary, @twinStyle, @outcome, @laterTransferOutcome,
          @createdAt
        )
        ON CONFLICT(signature_hash) DO UPDATE SET
          signature_json = excluded.signature_json,
          shape_hash = excluded.shape_hash,
          twin_json = excluded.twin_json,
          mapping_summary = excluded.mapping_summary,
          twin_style = excluded.twin_style,
          outcome = excluded.outcome,
          later_transfer_outcome = excluded.later_transfer_outcome,
          created_at = excluded.created_at`,
      )
      .run({
        ...precedent,
        signatureJson: JSON.stringify(persistedSignature),
        shapeHash,
        twinJson: JSON.stringify(twin),
      });
    return precedent;
  }

  matchPrecedent(input: StructuralSignature): PrecedentMatch | null {
    const parsedInput = StructuralSignatureSchema.parse(input);
    if (parsedInput.confidence < PRECEDENT_MATCH_THRESHOLD) return null;
    const signature = toAbstractSignature(parsedInput);
    const currentShapeHash = shapeFingerprint(parsedInput);
    const rows = this.database
      .prepare(
        `SELECT * FROM precedents
         WHERE pattern_id = ?
           AND outcome = 'unlocked'
           AND shape_hash = ?
           AND twin_json IS NOT NULL
         ORDER BY created_at DESC`,
      )
      .all(signature.patternId, currentShapeHash) as PrecedentRow[];

    let best: PrecedentMatch | null = null;
    for (const row of rows) {
      const storedSignature = toAbstractSignature(
        JSON.parse(row.signature_json),
      );
      if (storedSignature.confidence < PRECEDENT_MATCH_THRESHOLD) continue;
      const parsedTwin = TwinRenderSchema.safeParse(
        row.twin_json ? JSON.parse(row.twin_json) : null,
      );
      if (
        !parsedTwin.success ||
        !isReusableTwin(parsedTwin.data, parsedInput)
      ) {
        continue;
      }
      const confidenceAgreement =
        1 - Math.abs(signature.confidence - storedSignature.confidence);
      const score =
        PRECEDENT_MATCH_THRESHOLD +
        (1 - PRECEDENT_MATCH_THRESHOLD) * confidenceAgreement;
      if (
        score >= PRECEDENT_MATCH_THRESHOLD &&
        (best === null || score > best.score)
      ) {
        best = {
          score,
          twin: parsedTwin.data,
          precedent: PrecedentSchema.parse({
            signatureHash: row.signature_hash,
            patternId: row.pattern_id,
            mappingSummary: row.mapping_summary,
            twinStyle: row.twin_style,
            outcome: row.outcome,
            laterTransferOutcome: row.later_transfer_outcome,
            createdAt: row.created_at,
          }),
        };
      }
    }
    return best;
  }

  private ensureColumn(name: "shape_hash" | "twin_json", type: "TEXT"): void {
    const columns = this.database
      .prepare("PRAGMA table_info(precedents)")
      .all()
      .map((column) => (column as { name: string }).name);
    if (!columns.includes(name)) {
      this.database.exec(`ALTER TABLE precedents ADD COLUMN ${name} ${type}`);
    }
  }

  recordMatchFeedback(
    input: StructuralSignature,
    outcome: "not_same",
  ): boolean {
    const match = this.matchPrecedent(input);
    if (!match) return false;
    const result = this.database
      .prepare(
        `UPDATE precedents
         SET outcome = ?, later_transfer_outcome = ?
         WHERE signature_hash = ?`,
      )
      .run(outcome, outcome, match.precedent.signatureHash);
    return result.changes === 1;
  }

  assertReady(): void {
    const result = this.database
      .prepare("SELECT 1 AS ready")
      .get() as { ready?: unknown } | undefined;
    if (result?.ready !== 1) {
      throw new Error("Precedent store readiness query failed.");
    }
  }

  close(): void {
    this.database.close();
  }
}

const toAbstractSignature = (
  input: StructuralSignature | Record<string, unknown>,
): AbstractSignature => {
  const {
    originalAnchorRegions: _transientRegions,
    ...abstractInput
  } = input;
  return AbstractSignatureSchema.parse(abstractInput);
};

const signatureHash = (signature: AbstractSignature): string =>
  `sha256:${createHash("sha256").update(JSON.stringify(signature)).digest("hex")}`;

const shapeFingerprint = (signature: StructuralSignature): string => {
  const quantize = (value: number): number => Math.round(value * 20) / 20;
  const shape = signature.originalAnchorRegions
    .map(({ anchorId, region }) => ({
      anchorId,
      x: quantize(region.x),
      y: quantize(region.y),
      width: quantize(region.width),
      height: quantize(region.height),
    }))
    .sort((left, right) => left.anchorId.localeCompare(right.anchorId));
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(shape))
    .digest("hex")}`;
};

const surfaceStyle = (statement: string): string =>
  statement
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 3)
    .join("-");

const isReusableTwin = (
  twin: TwinRender,
  signature: StructuralSignature,
): boolean => {
  if (twin.patternId !== signature.patternId || twin.answerLeak) return false;
  const expectedAnchors = signature.originalAnchorRegions
    .map((anchor) => anchor.anchorId)
    .sort();
  const mappedAnchors = twin.mappingEdges
    .map((edge) => edge.originalAnchorId)
    .sort();
  return JSON.stringify(expectedAnchors) === JSON.stringify(mappedAnchors);
};

export const recordPrecedentOutcome = (
  store: PrecedentStore,
  signature: StructuralSignature,
  twin: TwinRender,
  outcome: "unlocked" | "wrong_twin" | "another_twin",
): Precedent =>
  store.savePrecedent({
    signature,
    twin,
    outcome: outcome === "unlocked" ? "unlocked" : "wrong_twin",
  });

export const recordPrecedentFeedback = (
  store: PrecedentStore,
  signature: StructuralSignature,
  outcome: "not_same",
): boolean => store.recordMatchFeedback(signature, outcome);
