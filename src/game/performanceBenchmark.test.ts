import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_BENCHMARK_DURATION_MS,
  PERFORMANCE_BENCHMARK_WARMUP_MS,
  PerformanceBenchmark,
} from "./performanceBenchmark";

describe("PerformanceBenchmark", () => {
  it("reports the agreed frame and draw-call acceptance budgets", () => {
    const benchmark = new PerformanceBenchmark();
    let timestampMs = 0;
    let report = null;

    while (
      timestampMs <=
      PERFORMANCE_BENCHMARK_WARMUP_MS + PERFORMANCE_BENCHMARK_DURATION_MS + 20
    ) {
      report = benchmark.recordFrame(16, 40, timestampMs) ?? report;
      timestampMs += 16;
    }

    expect(report).toMatchObject({
      maximumDrawCalls: 40,
      passed: true,
    });
    expect(report?.averageFramesPerSecond).toBeCloseTo(62.5, 1);
    expect(report?.p95FrameMs).toBe(16);
    expect(report?.p99FrameMs).toBe(16);
  });
});
