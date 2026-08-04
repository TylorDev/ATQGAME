import { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Group } from "three";
import { Arena } from "./Arena";
import { PlayerController } from "./PlayerController";
import { TestDummy } from "@/components/TestDummy/TestDummy";
import type { CameraSettings } from "@/game/camera";
import { TEST_DUMMY } from "@/game/constants";
import type { PlayerDebugStats } from "@/game/playerStats";
import { createInitialTestDummySnapshot } from "@/game/testDummy";
import type {
  PlayerCombatSettings,
  PlayerHudState,
  TestDummySnapshot,
} from "@/game/types";
import styles from "./GameCanvas.module.scss";

interface GameCanvasProps {
  cameraSettings: CameraSettings;
  combatSettings: PlayerCombatSettings;
  debugVisible: boolean;
  playerName: string;
  onDebugStatsChange: (stats: PlayerDebugStats) => void;
  onPlayerHudChange: (state: PlayerHudState) => void;
  onTestDummyHudChange: (state: TestDummySnapshot | null) => void;
  onCameraDistanceChange: (distanceDeltaMeters: number) => void;
}

export function GameCanvas({
  cameraSettings,
  combatSettings,
  debugVisible,
  playerName,
  onDebugStatsChange,
  onPlayerHudChange,
  onTestDummyHudChange,
  onCameraDistanceChange,
}: GameCanvasProps) {
  const [isTestDummySelected, setIsTestDummySelected] = useState(false);
  const [isTestDummyPursuitActive, setIsTestDummyPursuitActive] =
    useState(false);
  const testDummyRef = useRef<Group>(null);
  const [testDummySnapshot, setTestDummySnapshot] = useState(() =>
    createInitialTestDummySnapshot(TEST_DUMMY),
  );
  const testDummySnapshotRef = useRef(testDummySnapshot);
  const isTestDummySelectedRef = useRef(false);

  const handleTestDummyActivate = useCallback((): void => {
    isTestDummySelectedRef.current = true;
    setIsTestDummySelected(true);
    setIsTestDummyPursuitActive(true);
    onTestDummyHudChange(testDummySnapshotRef.current);
  }, [onTestDummyHudChange]);

  const handleTestDummyPursuitChange = useCallback((isActive: boolean): void => {
    setIsTestDummyPursuitActive(isActive);
  }, []);

  const handleTestDummySnapshotChange = useCallback(
    (snapshot: TestDummySnapshot): void => {
      testDummySnapshotRef.current = snapshot;
      setTestDummySnapshot(snapshot);

      if (isTestDummySelectedRef.current) {
        onTestDummyHudChange(snapshot);
      }
    },
    [onTestDummyHudChange],
  );

  const handleTestDummyDeselected = useCallback((): void => {
    isTestDummySelectedRef.current = false;
    setIsTestDummySelected(false);
    setIsTestDummyPursuitActive(false);
    onTestDummyHudChange(null);
  }, [onTestDummyHudChange]);

  return (
    <div className={styles.container}>
      <Canvas
        camera={{ position: [7, 9, 7], fov: 46, near: 0.1, far: 160 }}
        dpr={[1, 1.75]}
        shadows
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#101722"]} />
        <fog attach="fog" args={["#101722", 42, 105]} />
        <hemisphereLight args={["#9eb9c6", "#222832", 1.7]} />
        <directionalLight
          position={[7, 12, 5]}
          intensity={2.1}
          color="#f2d7ad"
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
        />
        <Arena />
        <TestDummy
          ref={testDummyRef}
          definition={TEST_DUMMY}
          snapshot={testDummySnapshot}
          selected={isTestDummySelected}
          onActivate={handleTestDummyActivate}
        />
        <PlayerController
          cameraSettings={cameraSettings}
          combatSettings={combatSettings}
          debugVisible={debugVisible}
          playerName={playerName}
          onDebugStatsChange={onDebugStatsChange}
          onPlayerHudChange={onPlayerHudChange}
          selectedTarget={isTestDummySelected ? TEST_DUMMY : null}
          isTargetPursuitActive={isTestDummyPursuitActive}
          targetObject={testDummyRef}
          onTestDummySnapshotChange={handleTestDummySnapshotChange}
          onTargetActivated={handleTestDummyActivate}
          onTargetPursuitChange={handleTestDummyPursuitChange}
          onTargetDeselected={handleTestDummyDeselected}
          onCameraDistanceChange={onCameraDistanceChange}
        />
      </Canvas>
    </div>
  );
}
