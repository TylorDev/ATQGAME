import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import {
  AdaptiveDprController,
  type ResolvedGraphicsQuality,
} from "@/game/graphicsQuality";
import { PerformanceBenchmark } from "@/game/performanceBenchmark";

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
  };
}

function getUsedHeapBytes(): number | undefined {
  return (performance as PerformanceWithMemory).memory?.usedJSHeapSize;
}

interface PerformanceTunerProps {
  performanceMode: boolean;
  quality: ResolvedGraphicsQuality;
}

export function PerformanceTuner({
  performanceMode,
  quality,
}: PerformanceTunerProps) {
  const { input } = useGameRuntimeServices();
  const { gl, setDpr } = useThree();
  const performanceBenchmark = useMemo(
    () => (performanceMode ? new PerformanceBenchmark() : null),
    [performanceMode],
  );
  const adaptiveDprController = useMemo(
    () =>
      new AdaptiveDprController(quality.minimumDpr, quality.maximumDpr),
    [quality.maximumDpr, quality.minimumDpr],
  );

  useEffect(() => {
    adaptiveDprController.reset();
    setDpr(quality.initialDpr);
  }, [adaptiveDprController, quality.initialDpr, setDpr]);

  useFrame((frameState, delta) => {
    const timestampMs = performance.now();
    const benchmarkReport = performanceBenchmark?.recordFrame(
      delta * 1_000,
      gl.info.render.calls,
      timestampMs,
      getUsedHeapBytes(),
      input.raycastMetrics.ground,
      input.raycastMetrics.target,
    );

    if (benchmarkReport) {
      console.info("[Performance benchmark]", benchmarkReport);
    }

    if (!quality.adaptiveDpr) {
      return;
    }

    const nextDpr = adaptiveDprController.recordFrame(
      delta * 1_000,
      timestampMs,
      frameState.viewport.dpr,
    );

    if (nextDpr !== null) {
      frameState.setDpr(nextDpr);
    }
  }, GAME_FRAME_PRIORITY.performance);

  return null;
}
