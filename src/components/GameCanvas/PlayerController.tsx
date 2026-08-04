import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { usePublishDamageLog } from "@/contexts/GameLogContext";
import {
  type OverheadStatusRegistration,
  type OverheadStatusUpdate,
  OverheadStatusRegistry,
} from "@/components/OverheadStatus/OverheadStatusSystem";
import type { PerformanceLoadScenarioHandle } from "@/components/PerformanceLoadScenario/PerformanceLoadScenario";
import type { TestDummyHandle } from "@/components/TestDummy/TestDummy";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  type Intersection,
  LineSegments,
  Mesh,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { CAMERA_DAMPING, HOLD_DELAY_MS, TEST_DUMMY } from "@/game/constants";
import {
  calculateCameraOffset,
  CAMERA_TARGET_HEIGHT,
  CAMERA_WHEEL_ZOOM_STEP_METERS,
  type CameraSettings,
} from "@/game/camera";
import {
  GameSimulation,
  GameUiSnapshotMask,
  UI_PUBLISH_INTERVAL_MS,
  type GameEvent,
} from "@/game/GameSimulation";
import { isEditableEventTarget } from "@/game/keybindings";
import type { PlayerDebugStats } from "@/game/playerStats";
import { PerformanceBenchmark } from "@/game/performanceBenchmark";
import { resolvePointerFacingYaw } from "@/game/playerOrientation";
import { UiPublishGate } from "@/game/uiPublishGate";
import {
  isGroundProjectionActive,
  isHeldGroundProjectionActive,
} from "@/game/pointerProjection";
import {
  AdaptiveDprController,
  type ResolvedGraphicsQuality,
} from "@/game/graphicsQuality";
import type {
  GroundPoint,
  PlayerCombatSettings,
  PlayerHudState,
  TestDummySnapshot,
} from "@/game/types";

const cameraTarget = new Vector3();
const desiredCameraPosition = new Vector3();
const interpolatedPlayerPosition = { x: 0, z: 0 };
const PLAYER_OVERHEAD_Y = 2.38;

interface PerformanceWithMemory extends Performance {
  memory?: {
    usedJSHeapSize: number;
  };
}

function getUsedHeapBytes(): number | undefined {
  return (performance as PerformanceWithMemory).memory?.usedJSHeapSize;
}

interface PlayerControllerProps {
  cameraSettings: CameraSettings;
  combatSettings: PlayerCombatSettings;
  debugVisible: boolean;
  playerName: string;
  simulation: GameSimulation;
  overheadRegistry: OverheadStatusRegistry;
  testDummyRef: RefObject<TestDummyHandle | null>;
  performanceLoadRef: RefObject<PerformanceLoadScenarioHandle | null>;
  performanceMode: boolean;
  quality: ResolvedGraphicsQuality;
  onDebugStatsChange: (stats: PlayerDebugStats) => void;
  onPlayerHudChange: (state: PlayerHudState) => void;
  onTestDummyHudChange: (state: TestDummySnapshot | null) => void;
  onTargetSelectionChange: (selected: boolean) => void;
  onCameraDistanceChange: (distanceDeltaMeters: number) => void;
}

function writePathIfChanged(
  positions: Float32Array,
  previous: Float32Array,
  geometry: BufferGeometry | null,
): void {
  let changed = false;

  for (let index = 0; index < positions.length; index += 1) {
    if (positions[index] !== previous[index]) {
      previous[index] = positions[index];
      changed = true;
    }
  }

  if (!changed || !geometry) {
    return;
  }

  const positionAttribute = geometry.getAttribute("position");

  if (positionAttribute instanceof BufferAttribute) {
    positionAttribute.needsUpdate = true;
  }
}

export function PlayerController({
  cameraSettings,
  combatSettings,
  debugVisible,
  playerName,
  simulation,
  overheadRegistry,
  testDummyRef,
  performanceLoadRef,
  performanceMode,
  quality,
  onDebugStatsChange,
  onPlayerHudChange,
  onTestDummyHudChange,
  onTargetSelectionChange,
  onCameraDistanceChange,
}: PlayerControllerProps) {
  const groupRef = useRef<Group>(null);
  const publishDamage = usePublishDamageLog();
  const pathLineRef = useRef<LineSegments>(null);
  const pathGeometryRef = useRef<BufferGeometry>(null);
  const selectedPathLineRef = useRef<LineSegments>(null);
  const selectedPathGeometryRef = useRef<BufferGeometry>(null);
  const destinationMarkerRef = useRef<Mesh>(null);
  const pointerNdc = useRef(new Vector2());
  const pointerId = useRef<number | null>(null);
  const rightPressStartedAt = useRef<number | null>(null);
  const raycaster = useMemo(() => new Raycaster(), []);
  const groundPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const rayIntersection = useMemo(() => new Vector3(), []);
  const targetIntersections = useRef<Intersection[]>([]);
  const raycastMetrics = useRef({ ground: 0, target: 0 });
  const pointerGroundCommand = useRef<{
    type: "update-pointer-ground";
    point: GroundPoint;
  }>({
    type: "update-pointer-ground",
    point: { x: 0, z: 0 },
  });
  const playerRegistrationRef =
    useRef<OverheadStatusRegistration | null>(null);
  const playerOverheadUpdate = useRef<OverheadStatusUpdate>({
    x: 0,
    y: PLAYER_OVERHEAD_Y,
    z: 0,
    currentHealth: 0,
    maximumHealth: 1,
    healthColor: "#74d641",
    effects: [],
  });
  const uiPublishGate = useMemo(
    () => new UiPublishGate(UI_PUBLISH_INTERVAL_MS),
    [],
  );
  const lastDummyHealthRef = useRef(Number.NaN);
  const lastDummyDefeatedRef = useRef<boolean | null>(null);
  const pathPositions = useMemo(() => new Float32Array(6), []);
  const selectedPathPositions = useMemo(() => new Float32Array(6), []);
  const previousPathPositions = useMemo(
    () => new Float32Array(6).fill(Number.NaN),
    [],
  );
  const previousSelectedPathPositions = useMemo(
    () => new Float32Array(6).fill(Number.NaN),
    [],
  );
  const cameraOffset = useMemo(() => {
    const offset = calculateCameraOffset(cameraSettings);
    return new Vector3(offset.x, offset.y, offset.z);
  }, [cameraSettings.distance, cameraSettings.pitchDegrees]);
  const performanceBenchmark = useMemo(
    () => (performanceMode ? new PerformanceBenchmark() : null),
    [performanceMode],
  );
  const adaptiveDprController = useMemo(
    () =>
      new AdaptiveDprController(quality.minimumDpr, quality.maximumDpr),
    [quality.maximumDpr, quality.minimumDpr],
  );
  const { camera, gl, setDpr } = useThree();

  useEffect(() => {
    adaptiveDprController.reset();
    setDpr(quality.initialDpr);
  }, [adaptiveDprController, quality.initialDpr, setDpr]);

  useEffect(() => {
    const registration = overheadRegistry.register("local-player");
    playerRegistrationRef.current = registration;

    return () => {
      overheadRegistry.unregister(registration);
      playerRegistrationRef.current = null;
    };
  }, [overheadRegistry]);

  useEffect(() => {
    const state = simulation.getRenderState();
    camera.position.set(
      state.currentPlayerPosition.x + cameraOffset.x,
      cameraOffset.y,
      state.currentPlayerPosition.z + cameraOffset.z,
    );
    camera.lookAt(
      state.currentPlayerPosition.x,
      CAMERA_TARGET_HEIGHT,
      state.currentPlayerPosition.z,
    );
  }, [camera, cameraOffset, simulation]);

  useEffect(() => {
    simulation.enqueueCommand({
      type: "update-combat-settings",
      settings: combatSettings,
    });
  }, [combatSettings, simulation]);

  useEffect(() => {
    simulation.enqueueCommand({ type: "update-player-name", playerName });
  }, [playerName, simulation]);

  useEffect(() => {
    const canvas = gl.domElement;

    const updatePointer = (event: PointerEvent): void => {
      const bounds = canvas.getBoundingClientRect();
      pointerNdc.current.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
    };

    const projectPointer = (): GroundPoint | null => {
      raycaster.setFromCamera(pointerNdc.current, camera);
      raycastMetrics.current.ground += 1;
      const hit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);
      return hit ? { x: hit.x, z: hit.z } : null;
    };

    const applyPointerFacing = (point: GroundPoint): void => {
      const group = groupRef.current;

      if (!group) {
        return;
      }

      group.rotation.y = resolvePointerFacingYaw(
        group.rotation.y,
        true,
        group.position,
        point,
      );
    };

    const isPointerOnTestDummy = (): boolean => {
      const target = testDummyRef.current?.objectRef.current;

      if (!target) {
        return false;
      }

      targetIntersections.current.length = 0;
      raycaster.setFromCamera(pointerNdc.current, camera);
      raycastMetrics.current.target += 1;
      raycaster.intersectObject(target, true, targetIntersections.current);
      return targetIntersections.current.length > 0;
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 2) {
        return;
      }

      event.preventDefault();
      updatePointer(event);

      if (isPointerOnTestDummy()) {
        simulation.enqueueCommand({ type: "activate-target" });
        return;
      }

      const point = projectPointer();

      if (!point) {
        return;
      }

      pointerId.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      const timestampMs = performance.now();
      rightPressStartedAt.current = timestampMs;
      applyPointerFacing(point);
      simulation.enqueueCommand({
        type: "begin-right-press",
        point,
        timestampMs,
      });
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (pointerId.current !== event.pointerId) {
        return;
      }

      updatePointer(event);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.button !== 2 || pointerId.current !== event.pointerId) {
        return;
      }

      updatePointer(event);
      const finalPoint = projectPointer();

      if (finalPoint) {
        applyPointerFacing(finalPoint);
      }

      simulation.enqueueCommand({
        type: "end-right-press",
        timestampMs: performance.now(),
      });

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      pointerId.current = null;
      rightPressStartedAt.current = null;
    };

    const handleContextMenu = (event: MouseEvent): void => {
      event.preventDefault();
    };

    const handleWheel = (event: WheelEvent): void => {
      const direction = Math.sign(event.deltaY);

      if (direction === 0) {
        return;
      }

      event.preventDefault();
      onCameraDistanceChange(direction * CAMERA_WHEEL_ZOOM_STEP_METERS);
    };

    const cancelInput = (): void => {
      const activePointerId = pointerId.current;

      if (
        activePointerId !== null &&
        canvas.hasPointerCapture(activePointerId)
      ) {
        canvas.releasePointerCapture(activePointerId);
      }

      pointerId.current = null;
      rightPressStartedAt.current = null;
      simulation.enqueueCommand({ type: "cancel-input" });
      simulation.resetFrameAccumulator();
    };

    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        cancelInput();
      }
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("blur", cancelInput);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("blur", cancelInput);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    camera,
    gl,
    groundPlane,
    onCameraDistanceChange,
    rayIntersection,
    raycaster,
    simulation,
    testDummyRef,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.code !== "KeyF" ||
        event.repeat ||
        isEditableEventTarget(event.target)
      ) {
        return;
      }

      simulation.enqueueCommand({ type: "activate-speed-boost" });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [simulation]);

  const visitEvent = useCallback(
    (event: GameEvent): void => {
      if (event.type === "damage") {
        publishDamage(event.payload);
        return;
      }

      if (event.type === "target-selected") {
        onTargetSelectionChange(true);
        return;
      }

      if (event.type === "target-deselected") {
        onTargetSelectionChange(false);
        onTestDummyHudChange(null);
      }
    },
    [onTargetSelectionChange, onTestDummyHudChange, publishDamage],
  );

  useFrame((frameState, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    let hasPointerGroundHit = false;

    if (isGroundProjectionActive(pointerId.current)) {
      raycaster.setFromCamera(pointerNdc.current, camera);
      raycastMetrics.current.ground += 1;
      const hit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);

      if (hit) {
        hasPointerGroundHit = true;
        pointerGroundCommand.current.point.x = hit.x;
        pointerGroundCommand.current.point.z = hit.z;
        simulation.enqueueCommand(pointerGroundCommand.current);
      }
    }

    const interpolationAlpha = simulation.advanceFrame(delta);
    const state = simulation.getRenderState();
    interpolatedPlayerPosition.x =
      state.previousPlayerPosition.x +
      (state.currentPlayerPosition.x - state.previousPlayerPosition.x) *
        interpolationAlpha;
    interpolatedPlayerPosition.z =
      state.previousPlayerPosition.z +
      (state.currentPlayerPosition.z - state.previousPlayerPosition.z) *
        interpolationAlpha;
    group.position.set(
      interpolatedPlayerPosition.x,
      0.9,
      interpolatedPlayerPosition.z,
    );

    group.rotation.y = resolvePointerFacingYaw(
      group.rotation.y,
      hasPointerGroundHit,
      interpolatedPlayerPosition,
      pointerGroundCommand.current.point,
    );

    desiredCameraPosition
      .set(interpolatedPlayerPosition.x, 0, interpolatedPlayerPosition.z)
      .add(cameraOffset);
    const cameraBlend = 1 - Math.exp(-CAMERA_DAMPING * delta);
    camera.position.lerp(desiredCameraPosition, cameraBlend);
    cameraTarget.set(
      interpolatedPlayerPosition.x,
      CAMERA_TARGET_HEIGHT,
      interpolatedPlayerPosition.z,
    );
    camera.lookAt(cameraTarget);

    const playerRegistration = playerRegistrationRef.current;

    if (playerRegistration) {
      const overheadUpdate = playerOverheadUpdate.current;
      overheadUpdate.x = interpolatedPlayerPosition.x;
      overheadUpdate.z = interpolatedPlayerPosition.z;
      overheadUpdate.currentHealth = state.playerCombat.currentHealth;
      overheadUpdate.maximumHealth = state.playerCombat.maximumHealth;
      overheadUpdate.effects = state.playerEffects;
      overheadRegistry.update(playerRegistration, overheadUpdate);
    }

    if (
      state.testDummy.currentHealth !== lastDummyHealthRef.current ||
      state.testDummy.isDefeated !== lastDummyDefeatedRef.current
    ) {
      testDummyRef.current?.update(state.testDummy);
      lastDummyHealthRef.current = state.testDummy.currentHealth;
      lastDummyDefeatedRef.current = state.testDummy.isDefeated;
    }

    if (state.performanceLoad) {
      performanceLoadRef.current?.update(
        state.performanceLoad,
        interpolationAlpha,
      );
    }

    simulation.drainEvents(visitEvent);
    const timestampMs = performance.now();
    const criticalUiChange = simulation.consumeCriticalUiDirty();
    if (uiPublishGate.shouldPublish(timestampMs, criticalUiChange)) {
      const mask = debugVisible
        ? GameUiSnapshotMask.All
        : GameUiSnapshotMask.Player | GameUiSnapshotMask.Target;
      const snapshot = simulation.createUiSnapshot(mask);
      onPlayerHudChange(snapshot.playerHud);
      if (snapshot.targetSelected) {
        onTestDummyHudChange(snapshot.testDummy);
      }

      if (debugVisible) {
        onDebugStatsChange(snapshot.debug);
      }

    }

    const showClickPath =
      debugVisible &&
      state.movement.mode === "clickToPoint" &&
      state.movement.isClickTargetConfirmed &&
      state.movement.target !== null;
    const showHeldDirection =
      debugVisible &&
      isHeldGroundProjectionActive(
        pointerId.current,
        rightPressStartedAt.current,
        timestampMs,
        HOLD_DELAY_MS,
      );
    const showPath = showClickPath || showHeldDirection;
    const pathTarget = showHeldDirection
      ? pointerGroundCommand.current.point
      : state.movement.target;

    if (pathLineRef.current) {
      pathLineRef.current.visible = showPath;
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.visible = showClickPath;
    }

    if (showPath && pathTarget) {
      pathPositions[0] = interpolatedPlayerPosition.x;
      pathPositions[1] = 0.07;
      pathPositions[2] = interpolatedPlayerPosition.z;
      pathPositions[3] = pathTarget.x;
      pathPositions[4] = 0.07;
      pathPositions[5] = pathTarget.z;
      writePathIfChanged(
        pathPositions,
        previousPathPositions,
        pathGeometryRef.current,
      );

      if (showClickPath) {
        destinationMarkerRef.current?.position.set(
          pathTarget.x,
          0.075,
          pathTarget.z,
        );
      }
    }

    if (selectedPathLineRef.current) {
      selectedPathLineRef.current.visible = state.targetSelected;
    }

    if (state.targetSelected) {
      selectedPathPositions[0] = interpolatedPlayerPosition.x;
      selectedPathPositions[1] = 0.09;
      selectedPathPositions[2] = interpolatedPlayerPosition.z;
      selectedPathPositions[3] = TEST_DUMMY.xMeters;
      selectedPathPositions[4] = 0.09;
      selectedPathPositions[5] = TEST_DUMMY.zMeters;
      writePathIfChanged(
        selectedPathPositions,
        previousSelectedPathPositions,
        selectedPathGeometryRef.current,
      );
    }

    overheadRegistry.flush();
    const benchmarkReport = performanceBenchmark?.recordFrame(
      delta * 1_000,
      gl.info.render.calls,
      timestampMs,
      getUsedHeapBytes(),
      raycastMetrics.current.ground,
      raycastMetrics.current.target,
    );

    if (benchmarkReport) {
      console.info("[Performance benchmark]", benchmarkReport);
    }

    if (quality.adaptiveDpr) {
      const nextDpr = adaptiveDprController.recordFrame(
        delta * 1_000,
        timestampMs,
        frameState.viewport.dpr,
      );

      if (nextDpr !== null) {
        frameState.setDpr(nextDpr);
      }
    }
  }, -100);

  return (
    <>
      <group ref={groupRef} position={[0, 0.9, 0]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.45, 0.9, 8, 16]} />
          <meshStandardMaterial
            color="#d9d4c7"
            roughness={0.52}
            metalness={0.08}
          />
        </mesh>

        <mesh position={[0, 0.12, 0.7]} rotation-x={Math.PI / 2} castShadow>
          <coneGeometry args={[0.17, 0.48, 3]} />
          <meshStandardMaterial
            color="#63c2b4"
            emissive="#285b54"
            emissiveIntensity={0.8}
          />
        </mesh>

        <mesh position={[0, -0.88, 0]} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[0.55, 0.67, 32]} />
          <meshBasicMaterial color="#d7a96b" transparent opacity={0.82} />
        </mesh>
      </group>

      <lineSegments ref={pathLineRef} visible={false} frustumCulled={false}>
        <bufferGeometry ref={pathGeometryRef}>
          <bufferAttribute attach="attributes-position" args={[pathPositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color="#63c2b4"
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </lineSegments>

      <lineSegments
        ref={selectedPathLineRef}
        visible={false}
        frustumCulled={false}
      >
        <bufferGeometry ref={selectedPathGeometryRef}>
          <bufferAttribute
            attach="attributes-position"
            args={[selectedPathPositions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#e47b71"
          transparent
          opacity={0.96}
          depthTest={false}
        />
      </lineSegments>

      <mesh
        ref={destinationMarkerRef}
        visible={false}
        rotation-x={-Math.PI / 2}
      >
        <ringGeometry args={[0.28, 0.42, 32]} />
        <meshBasicMaterial
          color="#63c2b4"
          transparent
          opacity={0.92}
          depthTest={false}
        />
      </mesh>
    </>
  );
}
