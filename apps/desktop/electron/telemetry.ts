import Database from "better-sqlite3";
import type { StaticsPatternId } from "@parallel/contracts";

export type OutcomeEvent =
  | "unlocked"
  | "wrong_twin"
  | "another_twin"
  | "dismissed"
  | "not_same";

export interface LocalOutcomeEvent {
  sessionId: string;
  outcome: OutcomeEvent;
  patternId: StaticsPatternId | null;
  recognitionMs: number | null;
  fullMappingMs: number | null;
  createdAt?: string;
}

export class TelemetryStore {
  private readonly database: Database.Database;

  constructor(databasePath: string, nativeBinding?: string) {
    this.database = new Database(databasePath, {
      ...(nativeBinding ? { nativeBinding } : {}),
    });
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS outcome_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        outcome TEXT NOT NULL,
        pattern_id TEXT,
        recognition_ms INTEGER,
        full_mapping_ms INTEGER,
        created_at TEXT NOT NULL
      );
    `);
  }

  record(event: LocalOutcomeEvent): void {
    this.database
      .prepare(
        `INSERT INTO outcome_events (
          session_id, outcome, pattern_id, recognition_ms, full_mapping_ms,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        event.sessionId,
        event.outcome,
        event.patternId,
        event.recognitionMs,
        event.fullMappingMs,
        event.createdAt ?? new Date().toISOString(),
      );
  }

  close(): void {
    this.database.close();
  }
}
