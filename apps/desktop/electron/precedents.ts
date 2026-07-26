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
  }

  savePrecedent(input: SavePrecedentInput): Precedent {
    const signature = StructuralSignatureSchema.parse(input.signature);
    const persistedSignature = toAbstractSignature(signature);
    const twin = TwinRenderSchema.parse(input.twin);
    const createdAt = new Date().toISOString();
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

    this.database
      .prepare(
        `INSERT INTO precedents (
          signature_hash, signature_json, pattern_id, mapping_summary,
          twin_style, outcome, later_transfer_outcome, created_at
        ) VALUES (
          @signatureHash, @signatureJson, @patternId, @mappingSummary,
          @twinStyle, @outcome, @laterTransferOutcome, @createdAt
        )
        ON CONFLICT(signature_hash) DO UPDATE SET
          mapping_summary = excluded.mapping_summary,
          twin_style = excluded.twin_style,
          outcome = excluded.outcome,
          later_transfer_outcome = excluded.later_transfer_outcome,
          created_at = excluded.created_at`,
      )
      .run({
        ...precedent,
        signatureJson: JSON.stringify(persistedSignature),
      });
    return precedent;
  }

  matchPrecedent(input: StructuralSignature): PrecedentMatch | null {
    const signature = toAbstractSignature(
      StructuralSignatureSchema.parse(input),
    );
    const rows = this.database
      .prepare(
        `SELECT * FROM precedents
         WHERE pattern_id = ? AND outcome = 'unlocked'`,
      )
      .all(signature.patternId) as PrecedentRow[];

    let best: PrecedentMatch | null = null;
    for (const row of rows) {
      const storedSignature = toAbstractSignature(
        JSON.parse(row.signature_json),
      );
      const score = structuralSimilarity(signature, storedSignature);
      if (
        score >= PRECEDENT_MATCH_THRESHOLD &&
        (best === null || score > best.score)
      ) {
        best = {
          score,
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

const surfaceStyle = (statement: string): string =>
  statement
    .toLowerCase()
    .replaceAll(/[^a-z0-9 ]/g, "")
    .split(/\s+/)
    .slice(0, 3)
    .join("-");

const exact = (left: string, right: string): number =>
  left.trim().toLowerCase() === right.trim().toLowerCase() ? 1 : 0;

const jaccard = (left: string[], right: string[]): number => {
  const leftSet = new Set(left.map((value) => value.toLowerCase()));
  const rightSet = new Set(right.map((value) => value.toLowerCase()));
  const intersection = [...leftSet].filter((value) => rightSet.has(value)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return union === 0 ? 1 : intersection / union;
};

export const structuralSimilarity = (
  left: AbstractSignature,
  right: AbstractSignature,
): number =>
  0.5 * exact(left.patternId, right.patternId) +
  0.15 * exact(left.invariant, right.invariant) +
  0.1 * exact(left.goal, right.goal) +
  0.1 * exact(left.courseConvention, right.courseConvention) +
  0.15 * jaccard(left.entities, right.entities);

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
