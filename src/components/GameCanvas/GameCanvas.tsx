import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Group, Vector2 } from "three";
import { BrowserGameInput } from "@/components/BrowserGameInput/BrowserGameInput";
import { DebugPath } from "@/components/DebugPath/DebugPath";
import { GameEventBridge } from "@/components/GameEventBridge/GameEventBridge";
import { GameFrameRunner } from "@/components/GameFrameRunner/GameFrameRunner";
import { RuntimeInputBridge } from "@/components/RuntimeInputBridge/RuntimeInputBridge";
import {
  OverheadStatusLayer,
  OverheadStatusRegistry,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import { OverheadFrameBridge } from "@/components/OverheadFrameBridge/OverheadFrameBridge";
import { PerformanceLoadView } from "@/components/PerformanceLoadView/PerformanceLoadView";
import { PerformanceTuner } from "@/components/PerformanceTuner/PerformanceTuner";
import { PlayerView } from "@/components/PlayerView/PlayerView";
import { TestDummyView } from "@/components/TestDummyView/TestDummyView";
import { ThirdPersonCamera } from "@/components/ThirdPersonCamera/ThirdPersonCamera";
import { UiSnapshotPublisher } from "@/components/UiSnapshotPublisher/UiSnapshotPublisher";
import {
  GameRuntimeContext,
  type GameInputFrameState,
  type GameRuntimeServices,
} from "@/contexts/GameRuntimeContext";
import { useGameUiSelector } from "@/contexts/GameUiContext";
import { TEST_DUMMY } from "@/game/constants";
import { createDefaultGameRuntime } from "@/game/core/createDefaultGameRuntime";
import { PERFORMANCE_LOAD_VISIBLE_ENTITIES } from "@/game/core/PerformanceLoadState";
import { resolveGraphicsQuality } from "@/game/graphicsQuality";
import { Arena } from "./Arena";
import styles from "./GameCanvas.module.scss";

function isPerformanceModeEnabled(): boolean {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("perf") === "1"
  );
}

function createInputFrameState(): GameInputFrameState {
  return {
    pointerNdc: new Vector2(),
    pointerId: null,
    rightPressStartedAtMs: null,
    groundPoint: { x: 0, z: 0 },
    hasGroundHit: false,
    hasPendingFacingPoint: false,
    raycastMetrics: { ground: 0, target: 0 },
  };
}

function GameCanvasComponent() {
  const cameraSettings = useGameUiSelector((state) => state.preferences.camera);
  const combatSettings = useGameUiSelector((state) => state.preferences.combat);
  const playerName = useGameUiSelector((state) => state.preferences.playerName);
  const graphics = useGameUiSelector((state) => state.preferences.graphics);
  const debugEnabled = useGameUiSelector((state) => state.visibility.debug);
  const quality = useMemo(
    () => resolveGraphicsQuality(graphics, window.devicePixelRatio),
    [graphics],
  );
  const debugVisible = import.meta.env.DEV && debugEnabled;
  const [performanceMode] = useState(isPerformanceModeEnabled);
  const [runtime] = useState(() =>
    createDefaultGameRuntime({
      initialTimeMs: performance.now(),
      wallClockOriginMs: Date.now(),
      playerName,
      combatSettings,
      performanceLoadEnabled: performanceMode,
    }),
  );
  const [overheadRegistry] = useState(() => new OverheadStatusRegistry(128));
  const [input] = useState(createInputFrameState);
  const targetObjectRef = useRef<Group>(null);
  const services = useMemo<GameRuntimeServices>(
    () => ({
      runtime,
      overheadRegistry,
      input,
      targetObjectRef,
    }),
    [input, overheadRegistry, runtime],
  );

  useEffect(() => {
    runtime.dispatch({
      type: "update-player-combat-settings",
      settings: combatSettings,
    });
  }, [combatSettings, runtime]);

  useEffect(() => {
    runtime.dispatch({ type: "update-player-name", playerName });
  }, [playerName, runtime]);

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
        <GameRuntimeContext.Provider value={services}>
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
          <TestDummyView definition={TEST_DUMMY} />
          {performanceMode ? (
            <PerformanceLoadView
              visibleCount={PERFORMANCE_LOAD_VISIBLE_ENTITIES}
            />
          ) : null}
          <PlayerView />
          <DebugPath visible={debugVisible} />
          <OverheadStatusLayer registry={overheadRegistry} />

          <BrowserGameInput />
          <RuntimeInputBridge />
          <GameFrameRunner />
          <ThirdPersonCamera settings={cameraSettings} />
          <GameEventBridge />
          <UiSnapshotPublisher />
          <OverheadFrameBridge />
          <PerformanceTuner
            performanceMode={performanceMode}
            quality={quality}
          />
        </GameRuntimeContext.Provider>
      </Canvas>
    </div>
  );
}

export const GameCanvas = memo(GameCanvasComponent);
