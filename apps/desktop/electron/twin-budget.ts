import Database from "better-sqlite3";
import type { EligiblePrecedentTwin } from "./precedents.js";

export const ROLLING_MONTH_MS = 30 * 24 * 60 * 60 * 1_000;

interface PersistentRollingTwinBudgetOptions {
  limit?: number;
  now?: () => number;
  nativeBinding?: string;
}

export interface BudgetDecision {
  allowed: boolean;
  remaining: number;
}

export interface TwinStartDecision extends BudgetDecision {
  charged: boolean;
}

interface EligiblePrecedentLookup {
  reopenEligibleTwin(signatureHash: string): EligiblePrecedentTwin | null;
}

export class PersistentRollingTwinBudget {
  private readonly database: Database.Database;
  private readonly limit: number;
  private readonly now: () => number;

  constructor(
    databasePath: string,
    options: PersistentRollingTwinBudgetOptions = {},
  ) {
    this.limit = options.limit ?? 100;
    this.now = options.now ?? Date.now;
    if (!Number.isSafeInteger(this.limit) || this.limit < 1) {
      throw new Error("Twin budget limit must be a positive integer");
    }
    this.database = new Database(databasePath, {
      ...(options.nativeBinding
        ? { nativeBinding: options.nativeBinding }
        : {}),
    });
    this.database.pragma("journal_mode = WAL");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS twin_budget_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        consumed_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS twin_budget_consumed_at
        ON twin_budget_events(consumed_at);
    `);
  }

  tryConsumeFreshRecognition(): BudgetDecision {
    return this.database.transaction(() => {
      const now = this.now();
      this.removeExpired(now);
      const consumed = this.consumedCount();
      if (consumed >= this.limit) {
        return { allowed: false, remaining: 0 };
      }
      this.database
        .prepare("INSERT INTO twin_budget_events (consumed_at) VALUES (?)")
        .run(now);
      return {
        allowed: true,
        remaining: this.limit - consumed - 1,
      };
    })();
  }

  remaining(): number {
    return this.database.transaction(() => {
      this.removeExpired(this.now());
      return Math.max(0, this.limit - this.consumedCount());
    })();
  }

  close(): void {
    this.database.close();
  }

  private removeExpired(now: number): void {
    this.database
      .prepare("DELETE FROM twin_budget_events WHERE consumed_at < ?")
      .run(now - ROLLING_MONTH_MS);
  }

  private consumedCount(): number {
    const row = this.database
      .prepare("SELECT COUNT(*) AS count FROM twin_budget_events")
      .get() as { count: number };
    return row.count;
  }
}

export class DesktopTwinBudgetAuthority {
  constructor(
    private readonly budget: PersistentRollingTwinBudget,
    private readonly eligiblePrecedents?: EligiblePrecedentLookup,
  ) {}

  authorizeFreshRecognition(
    env: Record<string, string | undefined>,
  ): TwinStartDecision {
    if (!env.OPENAI_API_KEY?.trim()) {
      return {
        allowed: true,
        charged: false,
        remaining: this.budget.remaining(),
      };
    }
    const decision = this.budget.tryConsumeFreshRecognition();
    return {
      ...decision,
      charged: decision.allowed,
    };
  }

  authorizeRegeneration(): TwinStartDecision {
    return {
      allowed: true,
      charged: false,
      remaining: this.budget.remaining(),
    };
  }

  reopenEligiblePrecedent(input: unknown): EligiblePrecedentTwin | null {
    if (
      typeof input !== "string" ||
      !/^sha256:[a-f0-9]{64}$/.test(input)
    ) {
      return null;
    }
    return this.eligiblePrecedents?.reopenEligibleTwin(input) ?? null;
  }
}
