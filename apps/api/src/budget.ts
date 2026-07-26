const ROLLING_MONTH_MS = 30 * 24 * 60 * 60 * 1_000;

export class RollingTwinBudget {
  private readonly freshTwinTimestamps: number[] = [];

  constructor(
    private readonly limit = 100,
    private readonly now: () => number = Date.now,
  ) {}

  tryConsumeFresh(): boolean {
    const cutoff = this.now() - ROLLING_MONTH_MS;
    while (
      this.freshTwinTimestamps[0] !== undefined &&
      this.freshTwinTimestamps[0] < cutoff
    ) {
      this.freshTwinTimestamps.shift();
    }
    if (this.freshTwinTimestamps.length >= this.limit) {
      return false;
    }
    this.freshTwinTimestamps.push(this.now());
    return true;
  }

  remaining(): number {
    return Math.max(0, this.limit - this.freshTwinTimestamps.length);
  }
}
