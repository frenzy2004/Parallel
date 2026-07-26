export interface GenerationLease {
  readonly id: number;
  readonly signal: AbortSignal;
}

export class GenerationSession {
  private sequence = 0;
  private controller: AbortController | null = null;
  private activeLease: GenerationLease | null = null;
  private cropDataUrl: string | null = null;

  begin(cropDataUrl: string): GenerationLease {
    this.invalidate();
    const controller = new AbortController();
    const lease = {
      id: ++this.sequence,
      signal: controller.signal,
    };
    this.controller = controller;
    this.activeLease = lease;
    this.cropDataUrl = cropDataUrl;
    return lease;
  }

  invalidate(): void {
    this.controller?.abort();
    this.controller = null;
    this.activeLease = null;
    this.cropDataUrl = null;
  }

  canDeliver(lease: GenerationLease): boolean {
    return this.activeLease === lease && !lease.signal.aborted;
  }

  cropForRegeneration(): string | null {
    return this.cropDataUrl;
  }
}

interface CloseableWindow {
  isDestroyed(): boolean;
  close(): void;
}

export const dismissOverlayState = (
  generation: GenerationSession,
  windows: ReadonlyArray<CloseableWindow | null>,
): void => {
  generation.invalidate();
  for (const window of windows) {
    if (window && !window.isDestroyed()) {
      window.close();
    }
  }
};

export interface RecoveryNotice {
  title: string;
  detail: string;
  canOpenSettings: boolean;
}

export type CaptureMode = "lasso" | "import";

export const captureModeForScreenAccess = (status: string): CaptureMode =>
  status === "granted" ? "lasso" : "import";

export const runGuarded = async <T>(
  task: () => T | Promise<T>,
  onFailure: (error: Error) => void | Promise<void>,
): Promise<T | undefined> => {
  try {
    return await task();
  } catch (error) {
    const normalized =
      error instanceof Error ? error : new Error("Unexpected desktop failure");
    try {
      await onFailure(normalized);
    } catch {
      // Recovery UI is best-effort; the original rejection remains handled.
    }
    return undefined;
  }
};
