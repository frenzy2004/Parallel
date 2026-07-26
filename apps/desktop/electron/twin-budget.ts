import Database from "better-sqlite3";

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

export type FreshRecognitionRun<T> =
  | {
      started: false;
      decision: TwinStartDecision;
    }
  | {
      started: true;
      decision: TwinStartDecision;
      value: T;
    };

export interface FreshRecognitionReservation {
  releaseForValidatedPrecedentMatch(): boolean;
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

  tryConsumeFreshRecognition(): BudgetDecision & {
    reservationId: number | null;
  } {
    return this.database.transaction(() => {
      const now = this.now();
      this.removeExpired(now);
      const consumed = this.consumedCount();
      if (consumed >= this.limit) {
        return { allowed: false, remaining: 0, reservationId: null };
      }
      const result = this.database
        .prepare("INSERT INTO twin_budget_events (consumed_at) VALUES (?)")
        .run(now);
      return {
        allowed: true,
        remaining: this.limit - consumed - 1,
        reservationId: Number(result.lastInsertRowid),
      };
    })();
  }

  releaseReservation(reservationId: number): boolean {
    if (!Number.isSafeInteger(reservationId) || reservationId < 1) {
      return false;
    }
    return (
      this.database
        .prepare("DELETE FROM twin_budget_events WHERE id = ?")
        .run(reservationId).changes === 1
    );
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

  assertReady(): void {
    const result = this.database
      .prepare("SELECT 1 AS ready")
      .get() as { ready?: unknown } | undefined;
    if (result?.ready !== 1) {
      throw new Error("Twin budget store readiness query failed.");
    }
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
  constructor(private readonly budget: PersistentRollingTwinBudget) {}

  authorizeFreshRecognition(
    env: Record<string, string | undefined>,
  ): TwinStartDecision {
    return this.reserveFreshRecognition(env).decision;
  }

  authorizeRegeneration(): TwinStartDecision {
    return {
      allowed: true,
      charged: false,
      remaining: this.budget.remaining(),
    };
  }

  async runFreshRecognition<T>(
    env: Record<string, string | undefined>,
    work: (reservation: FreshRecognitionReservation) => T | Promise<T>,
  ): Promise<FreshRecognitionRun<T>> {
    const { decision, reservationId } = this.reserveFreshRecognition(env);
    if (!decision.allowed) {
      return { started: false, decision };
    }
    let released = false;
    const releaseForValidatedPrecedentMatch = (): boolean => {
      if (released || reservationId === null) return false;
      released = this.budget.releaseReservation(reservationId);
      return released;
    };
    const value = await work({ releaseForValidatedPrecedentMatch });
    return {
      started: true,
      decision: released
        ? {
            allowed: true,
            charged: false,
            remaining: this.budget.remaining(),
          }
        : decision,
      value,
    };
  }

  async runRegeneration<T>(
    work: () => T | Promise<T>,
  ): Promise<{ decision: TwinStartDecision; value: T }> {
    return {
      decision: this.authorizeRegeneration(),
      value: await work(),
    };
  }

  private reserveFreshRecognition(
    env: Record<string, string | undefined>,
  ): {
    decision: TwinStartDecision;
    reservationId: number | null;
  } {
    if (env.PARALLEL_DEMO_MODE === "1" || !env.OPENAI_API_KEY) {
      return {
        decision: {
          allowed: true,
          charged: false,
          remaining: this.budget.remaining(),
        },
        reservationId: null,
      };
    }
    const { reservationId, ...decision } =
      this.budget.tryConsumeFreshRecognition();
    return {
      decision: {
        ...decision,
        charged: decision.allowed,
      },
      reservationId,
    };
  }
}
