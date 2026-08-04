import { memo, useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import {
  OverheadStatusLayer,
  OverheadStatusRegistry,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import {
  PerformanceLoadScenario,
  type PerformanceLoadScenarioHandle,
} from "@/components/PerformanceLoadScenario/PerformanceLoadScenario";
import {
  TestDummy,
  type TestDummyHandle,
} from "@/components/TestDummy/TestDummy";
import type { CameraSettings } from "@/game/camera";
import { TEST_DUMMY } from "@/game/constants";
import {
  GameSimulation,
  PERFORMANCE_LOAD_VISIBLE_ENTITIES,
} from "@/game/GameSimulation";
import type { ResolvedGraphicsQuality } from "@/game/graphicsQuality";
import type { PlayerDebugStats } from "@/game/playerStats";
import type {
  PlayerCombatSettings,
  PlayerHudState,
  TestDummySnapshot,
} from "@/game/types";
import { Arena } from "./Arena";
import { PlayerController } from "./PlayerController";
import styles from "./GameCanvas.module.scss";

interface GameCanvasProps {
  cameraSettings: CameraSettings;
  combatSettings: PlayerCombatSettings;
  debugVisible: boolean;
  playerName: string;
  quality: ResolvedGraphicsQuality;
  onDebugStatsChange: (stats: PlayerDebugStats) => void;
  onPlayerHudChange: (state: PlayerHudState) => void;
  onTestDummyHudChange: (state: TestDummySnapshot | null) => void;
  onCameraDistanceChange: (distanceDeltaMeters: number) => void;
}

function isPerformanceModeEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("perf") === "1"
  );
}

function GameCanvasComponent({
  cameraSettings,
  combatSettings,
  debugVisible,
  playerName,
  quality,
  onDebugStatsChange,
  onPlayerHudChange,
  onTestDummyHudChange,
  onCameraDistanceChange,
}: GameCanvasProps) {
  const [performanceMode] = useState(isPerformanceModeEnabled);
  const [simulation] = useState(
    () =>
      new GameSimulation({
        initialTimeMs: performance.now(),
        wallClockOriginMs: Date.now(),
        playerName,
        combatSettings,
        performanceLoadEnabled: performanceMode,
      }),
  );
  const [overheadRegistry] = useState(() => new OverheadStatusRegistry(128));
  const [isTestDummySelected, setIsTestDummySelected] = useState(false);
  const testDummyRef = useRef<TestDummyHandle>(null);
  const performanceLoadRef = useRef<PerformanceLoadScenarioHandle>(null);

  const handleTestDummyActivate = useCallback((): void => {
    simulation.enqueueCommand({ type: "activate-target" });
  }, [simulation]);

  const handleTargetSelectionChange = useCallback((selected: boolean): void => {
    setIsTestDummySelected(selected);
  }, []);

  const shadowMapSize = quality.shadowMapSize || 512;

  return (
    <div className={styles.container}>
      <Canvas
        key={quality.antialias ? "renderer-antialias" : "renderer-no-antialias"}
        camera={{ position: [7, 9, 7], fov: 46, near: 0.1, far: 160 }}
        dpr={quality.initialDpr}
        shadows={quality.shadows}
        gl={{
          antialias: quality.antialias,
          powerPreference: "high-performance",
        }}
      >
        <color attach="background" args={["#101722"]} />
        <fog attach="fog" args={["#101722", 42, 105]} />
        <hemisphereLight args={["#9eb9c6", "#222832", 1.7]} />
        <directionalLight
          position={[7, 12, 5]}
          intensity={2.1}
          color="#f2d7ad"
          castShadow={quality.shadows}
          shadow-mapSize={[shadowMapSize, shadowMapSize]}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <Arena />
        <TestDummy
          ref={testDummyRef}
          definition={TEST_DUMMY}
          selected={isTestDummySelected}
          onActivate={handleTestDummyActivate}
          registry={overheadRegistry}
        />
        {performanceMode ? (
          <PerformanceLoadScenario
            ref={performanceLoadRef}
            registry={overheadRegistry}
            visibleCount={PERFORMANCE_LOAD_VISIBLE_ENTITIES}
          />
        ) : null}
        <PlayerController
          cameraSettings={cameraSettings}
          combatSettings={combatSettings}
          debugVisible={debugVisible}
          playerName={playerName}
          simulation={simulation}
          overheadRegistry={overheadRegistry}
          testDummyRef={testDummyRef}
          performanceLoadRef={performanceLoadRef}
          performanceMode={performanceMode}
          quality={quality}
          onDebugStatsChange={onDebugStatsChange}
          onPlayerHudChange={onPlayerHudChange}
          onTestDummyHudChange={onTestDummyHudChange}
          onTargetSelectionChange={handleTargetSelectionChange}
          onCameraDistanceChange={onCameraDistanceChange}
        />
        <OverheadStatusLayer registry={overheadRegistry} />
      </Canvas>
    </div>
  );
}

export const GameCanvas = memo(GameCanvasComponent);
