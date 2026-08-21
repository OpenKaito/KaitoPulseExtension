
export const FLUSH_INTERVAL_MS = 5_000;
export const FLUSH_SIZE_THRESHOLD = 20;

export class FlushScheduler {
  private timer: ReturnType<typeof setInterval> | undefined;
  private disposedFlag = false;

  constructor(private readonly flush: () => void) {}

  get disposed(): boolean {
    return this.disposedFlag;
  }

  start(): void {
    this.timer = setInterval(this.flush, FLUSH_INTERVAL_MS);
  }

  dispose(beforeFinalFlush?: () => void): void {
    if (this.disposedFlag) return;
    this.disposedFlag = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    beforeFinalFlush?.();
    this.flush();
  }
}
