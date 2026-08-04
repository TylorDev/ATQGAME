export const PERFORMANCE_BENCHMARK_WARMUP_MS = 10_000;
export const PERFORMANCE_BENCHMARK_DURATION_MS = 60_000;
const MAX_FRAME_SAMPLES = 10_000;

export interface PerformanceBenchmarkReport {
  averageFramesPerSecond: number;
  p95FrameMs: number;
  p99FrameMs: number;
  maximumDrawCalls: number;
  heapGrowthBytes: number | null;
  groundRaycasts: number;
  targetRaycasts: number;
  sampleCount: number;
  passed: boolean;
}

function percentile(sortedValues: readonly number[], ratio: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  const index = Math.min(
    Math.ceil(sortedValues.length * ratio) - 1,
    sortedValues.length - 1,
  );
  return sortedValues[Math.max(index, 0)];
}

export class PerformanceBenchmark {
  private readonly frameTimes = new Float64Array(MAX_FRAME_SAMPLES);
  private startedAtMs: number | null = null;
  private sampleCount = 0;
  private totalFrameMs = 0;
  private maximumDrawCalls = 0;
  private completed = false;
  private initialHeapBytes: number | null = null;
  private latestHeapBytes: number | null = null;
  private groundRaycasts = 0;
  private targetRaycasts = 0;

  recordFrame(
    frameDurationMs: number,
    drawCalls: number,
    timestampMs: number,
    usedHeapBytes?: number,
    groundRaycasts = 0,
    targetRaycasts = 0,
  ): PerformanceBenchmarkReport | null {
    if (this.completed || frameDurationMs <= 0) {
      return null;
    }

    this.startedAtMs ??= timestampMs;
    const elapsedMs = timestampMs - this.startedAtMs;

    if (elapsedMs < PERFORMANCE_BENCHMARK_WARMUP_MS) {
      return null;
    }

    if (
      elapsedMs <
      PERFORMANCE_BENCHMARK_WARMUP_MS + PERFORMANCE_BENCHMARK_DURATION_MS
    ) {
      if (this.sampleCount < this.frameTimes.length) {
        this.frameTimes[this.sampleCount] = frameDurationMs;
        this.sampleCount += 1;
        this.totalFrameMs += frameDurationMs;
      }

      this.maximumDrawCalls = Math.max(this.maximumDrawCalls, drawCalls);

      if (Number.isFinite(usedHeapBytes)) {
        this.initialHeapBytes ??= usedHeapBytes as number;
        this.latestHeapBytes = usedHeapBytes as number;
      }

      this.groundRaycasts = groundRaycasts;
      this.targetRaycasts = targetRaycasts;

      return null;
    }

    this.completed = true;
    const sortedFrameTimes = Array.from(
      this.frameTimes.subarray(0, this.sampleCount),
    ).sort((left, right) => left - right);
    const averageFrameMs =
      this.sampleCount > 0 ? this.totalFrameMs / this.sampleCount : 0;
    const averageFramesPerSecond =
      averageFrameMs > 0 ? 1_000 / averageFrameMs : 0;
    const p95FrameMs = percentile(sortedFrameTimes, 0.95);
    const p99FrameMs = percentile(sortedFrameTimes, 0.99);
    const heapGrowthBytes =
      this.initialHeapBytes !== null && this.latestHeapBytes !== null
        ? this.latestHeapBytes - this.initialHeapBytes
        : null;

    return {
      averageFramesPerSecond,
      p95FrameMs,
      p99FrameMs,
      maximumDrawCalls: this.maximumDrawCalls,
      heapGrowthBytes,
      groundRaycasts: this.groundRaycasts,
      targetRaycasts: this.targetRaycasts,
      sampleCount: this.sampleCount,
      passed:
        averageFramesPerSecond >= 58 &&
        p95FrameMs <= 18.2 &&
        p99FrameMs <= 25 &&
        this.maximumDrawCalls <= 80 &&
        (heapGrowthBytes === null || heapGrowthBytes <= 5 * 1024 * 1024),
    };
  }
}
