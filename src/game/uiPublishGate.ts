export class UiPublishGate {
  private lastPublishedAtMs = Number.NEGATIVE_INFINITY;

  constructor(private readonly intervalMs: number) {}

  shouldPublish(timestampMs: number, critical: boolean): boolean {
    if (
      !critical &&
      timestampMs - this.lastPublishedAtMs < this.intervalMs
    ) {
      return false;
    }

    this.lastPublishedAtMs = timestampMs;
    return true;
  }

  reset(): void {
    this.lastPublishedAtMs = Number.NEGATIVE_INFINITY;
  }
}
