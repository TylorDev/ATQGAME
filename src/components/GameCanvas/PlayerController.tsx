import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { usePublishDamageLog } from "@/contexts/GameLogContext";
import {
  OverheadStatus,
  type OverheadStatusHandle,
} from "@/components/OverheadStatus/OverheadStatus";
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  Mesh,
  Plane,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import {
  BURNING_TILE,
  CAMERA_DAMPING,
  MAX_FRAME_DELTA_SECONDS,
  OBSTACLES,
  PLAYER_AUTO_ATTACK_RANGE_METERS,
  PLAYER_RADIUS_METERS,
  ROTATION_DAMPING,
  TARGET_DESELECT_DISTANCE_METERS,
  TEST_DUMMY,
} from "@/game/constants";
import {
  calculateCameraOffset,
  CAMERA_TARGET_HEIGHT,
  CAMERA_WHEEL_ZOOM_STEP_METERS,
  type CameraSettings,
} from "@/game/camera";
import { MovementController } from "@/game/MovementController";
import { PlayerVitalityController } from "@/game/combat";
import {
  BurningHazardController,
  circleIntersectsGroundHazard,
} from "@/game/hazards";
import { isEditableEventTarget } from "@/game/keybindings";
import {
  getActivePlayerEffects,
  getCurrentPlayerSpeedMetersPerSecond,
  SpeedBoostController,
  type PlayerDebugStats,
} from "@/game/playerStats";
import {
  AutoAttackController,
  TestDummyController,
  isWithinAutoAttackRange,
} from "@/game/testDummy";
import type {
  GroundPoint,
  PlayerCombatSettings,
  PlayerHudState,
  TestDummyDefinition,
  TestDummySnapshot,
} from "@/game/types";

const cameraTarget = new Vector3();
const desiredCameraPosition = new Vector3();
const DEBUG_SAMPLE_INTERVAL_MS = 100;
const DEATH_NOTICE_DURATION_MS = 3_000;

interface PlayerControllerProps {
  cameraSettings: CameraSettings;
  combatSettings: PlayerCombatSettings;
  debugVisible: boolean;
  playerName: string;
  onDebugStatsChange: (stats: PlayerDebugStats) => void;
  onPlayerHudChange: (state: PlayerHudState) => void;
  selectedTarget: TestDummyDefinition | null;
  isTargetPursuitActive: boolean;
  targetObject: RefObject<Group | null>;
  onTestDummySnapshotChange: (snapshot: TestDummySnapshot) => void;
  onTargetActivated: () => void;
  onTargetPursuitChange: (isActive: boolean) => void;
  onTargetDeselected: () => void;
  onCameraDistanceChange: (distanceDeltaMeters: number) => void;
}

function areEffectsEqual(
  previousEffects: PlayerHudState["activeEffects"],
  nextEffects: PlayerHudState["activeEffects"],
): boolean {
  return (
    previousEffects.length === nextEffects.length &&
    previousEffects.every((effect, index) => effect.id === nextEffects[index]?.id)
  );
}

function arePlayerHudStatesEqual(
  previous: PlayerHudState | null,
  next: PlayerHudState,
): boolean {
  return (
    previous !== null &&
    previous.currentHealth === next.currentHealth &&
    previous.maximumHealth === next.maximumHealth &&
    previous.defensePercent === next.defensePercent &&
    previous.isDeathNoticeVisible === next.isDeathNoticeVisible &&
    areEffectsEqual(previous.activeEffects, next.activeEffects)
  );
}

function areTestDummySnapshotsEqual(
  previous: TestDummySnapshot | null,
  next: TestDummySnapshot,
): boolean {
  return (
    previous !== null &&
    previous.currentHealth === next.currentHealth &&
    previous.lastDamageReceived === next.lastDamageReceived &&
    previous.totalDamageReceived === next.totalDamageReceived &&
    previous.damagePerSecond === next.damagePerSecond &&
    previous.isDefeated === next.isDefeated &&
    previous.respawnRemainingSeconds === next.respawnRemainingSeconds
  );
}

function dampAngle(
  current: number,
  target: number,
  damping: number,
  delta: number,
): number {
  const difference = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + difference * (1 - Math.exp(-damping * delta));
}

export function PlayerController({
  cameraSettings,
  combatSettings,
  debugVisible,
  playerName,
  onDebugStatsChange,
  onPlayerHudChange,
  selectedTarget,
  isTargetPursuitActive,
  targetObject,
  onTestDummySnapshotChange,
  onTargetActivated,
  onTargetPursuitChange,
  onTargetDeselected,
  onCameraDistanceChange,
}: PlayerControllerProps) {
  const groupRef = useRef<Group>(null);
  const publishDamage = usePublishDamageLog();
  const pathLineRef = useRef<LineSegments>(null);
  const pathGeometryRef = useRef<BufferGeometry>(null);
  const selectedPathLineRef = useRef<LineSegments>(null);
  const selectedPathGeometryRef = useRef<BufferGeometry>(null);
  const destinationMarkerRef = useRef<Mesh>(null);
  const overheadStatusRef = useRef<OverheadStatusHandle>(null);
  const pointerNdc = useRef(new Vector2());
  const pointerId = useRef<number | null>(null);
  const lastDebugSampleAtMs = useRef<number | null>(null);
  const wasDebugVisible = useRef(false);
  const previousCombatSettings = useRef(combatSettings);
  const lastPlayerHudState = useRef<PlayerHudState | null>(null);
  const lastTestDummySnapshot = useRef<TestDummySnapshot | null>(null);
  const lastTestDummySampleAtMs = useRef<number | null>(null);
  const deathNoticeUntilMs = useRef(0);
  const controller = useMemo(() => new MovementController(), []);
  const speedBoostController = useMemo(() => new SpeedBoostController(), []);
  const vitalityController = useMemo(() => new PlayerVitalityController(), []);
  const burningHazardController = useMemo(
    () => new BurningHazardController(),
    [],
  );
  const testDummyController = useMemo(
    () => new TestDummyController(TEST_DUMMY),
    [],
  );
  const autoAttackController = useMemo(() => new AutoAttackController(), []);
  const raycaster = useMemo(() => new Raycaster(), []);
  const groundPlane = useMemo(() => new Plane(new Vector3(0, 1, 0), 0), []);
  const rayIntersection = useMemo(() => new Vector3(), []);
  const pathPositions = useMemo(() => new Float32Array(6), []);
  const selectedPathPositions = useMemo(() => new Float32Array(6), []);
  const cameraOffset = useMemo(() => {
    const offset = calculateCameraOffset(cameraSettings);
    return new Vector3(offset.x, offset.y, offset.z);
  }, [cameraSettings.distance, cameraSettings.pitchDegrees]);
  const { camera, gl } = useThree();

  useEffect(() => {
    const snapshot = controller.getSnapshot();
    camera.position.set(
      snapshot.position.x + cameraOffset.x,
      cameraOffset.y,
      snapshot.position.z + cameraOffset.z,
    );
    camera.lookAt(
      snapshot.position.x,
      CAMERA_TARGET_HEIGHT,
      snapshot.position.z,
    );
  }, [camera, cameraOffset, controller]);

  useEffect(() => {
    if (selectedTarget && isTargetPursuitActive) {
      controller.resumeFollowTarget(
        { x: selectedTarget.xMeters, z: selectedTarget.zMeters },
        PLAYER_AUTO_ATTACK_RANGE_METERS,
      );
      return;
    }

    controller.pauseFollowTarget();
  }, [controller, isTargetPursuitActive, selectedTarget]);

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
      const hit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);
      return hit ? { x: hit.x, z: hit.z } : null;
    };

    const isPointerOnTestDummy = (): boolean => {
      const target = targetObject.current;

      if (!target) {
        return false;
      }

      raycaster.setFromCamera(pointerNdc.current, camera);
      return raycaster.intersectObject(target, true).length > 0;
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 2) {
        return;
      }

      event.preventDefault();
      updatePointer(event);

      if (isPointerOnTestDummy()) {
        const target = selectedTarget ?? TEST_DUMMY;
        controller.resumeFollowTarget(
          { x: target.xMeters, z: target.zMeters },
          PLAYER_AUTO_ATTACK_RANGE_METERS,
        );
        onTargetActivated();
        return;
      }

      const point = projectPointer();

      if (!point) {
        return;
      }

      controller.pauseFollowTarget();
      onTargetPursuitChange(false);
      pointerId.current = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      controller.beginRightPress(point, performance.now());
    };

    const handlePointerMove = (event: PointerEvent): void => {
      updatePointer(event);
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.button !== 2 || pointerId.current !== event.pointerId) {
        return;
      }

      controller.endRightPress(performance.now());

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      pointerId.current = null;
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
      controller.cancelInput();
      pointerId.current = null;
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
    controller,
    gl,
    groundPlane,
    onTargetActivated,
    onCameraDistanceChange,
    onTargetPursuitChange,
    rayIntersection,
    raycaster,
    selectedTarget,
    targetObject,
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

      speedBoostController.activate(performance.now());
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [speedBoostController]);

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    raycaster.setFromCamera(pointerNdc.current, camera);
    const pointerHit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);

    if (pointerHit) {
      controller.updatePointerGround({ x: pointerHit.x, z: pointerHit.z });
    }

    const timestampMs = performance.now();
    const speedBoost = speedBoostController.getSnapshot(timestampMs);
    const currentSpeedMetersPerSecond =
      getCurrentPlayerSpeedMetersPerSecond(speedBoost);
    const snapshot = controller.step(
      delta,
      timestampMs,
      OBSTACLES,
      currentSpeedMetersPerSecond,
    );
    group.position.set(snapshot.position.x, 0.9, snapshot.position.z);

    const dummyStep = testDummyController.step(delta, timestampMs);
    let dummySnapshot = dummyStep.snapshot;
    let activeTarget = selectedTarget;

    if (activeTarget) {
      const targetPosition = {
        x: activeTarget.xMeters,
        z: activeTarget.zMeters,
      };
      const targetDistanceMeters = Math.hypot(
        snapshot.position.x - targetPosition.x,
        snapshot.position.z - targetPosition.z,
      );

      if (targetDistanceMeters >= TARGET_DESELECT_DISTANCE_METERS) {
        controller.clearFollowTarget();
        activeTarget = null;
        onTargetDeselected();
      }
    }

    let didDummyStateChange = dummyStep.didRespawn;

    if (activeTarget) {
      const targetPosition = {
        x: activeTarget.xMeters,
        z: activeTarget.zMeters,
      };
      const attacks = autoAttackController.step(
        delta,
        !dummySnapshot.isDefeated &&
          isWithinAutoAttackRange(snapshot.position, targetPosition),
      );

      for (let attack = 0; attack < attacks; attack += 1) {
        const damageResult = testDummyController.applyDamage(
          autoAttackController.getDamagePerAttack(),
          timestampMs,
        );
        didDummyStateChange ||= damageResult.didApplyDamage;
        dummySnapshot = damageResult.snapshot;

        if (damageResult.appliedDamage > 0) {
          publishDamage({
            occurredAtMs: Date.now(),
            appliedDamage: damageResult.appliedDamage,
            receiver: {
              id: TEST_DUMMY.id,
              kind: "test-dummy",
              displayName: TEST_DUMMY.displayName,
            },
            source: {
              id: "local-player",
              kind: "player",
              displayName: playerName,
            },
          });
        }
      }
    } else {
      autoAttackController.step(0, false);
    }

    const isTestDummySnapshotChanged = !areTestDummySnapshotsEqual(
      lastTestDummySnapshot.current,
      dummySnapshot,
    );
    const isTestDummySampleDue =
      lastTestDummySampleAtMs.current === null ||
      timestampMs - lastTestDummySampleAtMs.current >= DEBUG_SAMPLE_INTERVAL_MS;

    if (
      didDummyStateChange ||
      (activeTarget !== null &&
        isTestDummySnapshotChanged &&
        isTestDummySampleDue)
    ) {
      onTestDummySnapshotChange(dummySnapshot);
      lastTestDummySnapshot.current = dummySnapshot;
      lastTestDummySampleAtMs.current = timestampMs;
    }

    if (
      previousCombatSettings.current.maximumHealth !==
        combatSettings.maximumHealth ||
      previousCombatSettings.current.defensePercent !==
        combatSettings.defensePercent
    ) {
      vitalityController.updateSettings(combatSettings);
      previousCombatSettings.current = combatSettings;
    }

    const isInsideBurningTile = circleIntersectsGroundHazard(
      snapshot.position,
      PLAYER_RADIUS_METERS,
      BURNING_TILE,
    );
    const burningHazard = burningHazardController.step(
      Math.min(Math.max(delta, 0), MAX_FRAME_DELTA_SECONDS),
      isInsideBurningTile,
      BURNING_TILE.tickIntervalSeconds,
    );

    for (let tick = 0; tick < burningHazard.damageTicks; tick += 1) {
      const damageResult = vitalityController.applyDamage(
        BURNING_TILE.damagePerTick,
      );

      if (damageResult.appliedDamage > 0) {
        publishDamage({
          occurredAtMs: Date.now(),
          appliedDamage: damageResult.appliedDamage,
          receiver: {
            id: "local-player",
            kind: "player",
            displayName: playerName,
          },
          source: {
            id: BURNING_TILE.id,
            kind: "entity",
            displayName: BURNING_TILE.displayName,
          },
        });
      }

      if (damageResult.didDie) {
        deathNoticeUntilMs.current = timestampMs + DEATH_NOTICE_DURATION_MS;
      }
    }

    const combatSnapshot = vitalityController.getSnapshot();
    const activeEffects = getActivePlayerEffects(
      speedBoost,
      burningHazard.isActive,
    );
    const playerHudState: PlayerHudState = {
      ...combatSnapshot,
      activeEffects,
      isDeathNoticeVisible: timestampMs < deathNoticeUntilMs.current,
    };

    overheadStatusRef.current?.update({
      ...combatSnapshot,
      effects: activeEffects,
    });

    if (!arePlayerHudStatesEqual(lastPlayerHudState.current, playerHudState)) {
      onPlayerHudChange(playerHudState);
      lastPlayerHudState.current = playerHudState;
    }

    const targetRotation = Math.atan2(snapshot.facing.x, snapshot.facing.z);
    group.rotation.y = dampAngle(
      group.rotation.y,
      targetRotation,
      ROTATION_DAMPING,
      delta,
    );

    desiredCameraPosition
      .set(snapshot.position.x, 0, snapshot.position.z)
      .add(cameraOffset);
    const cameraBlend = 1 - Math.exp(-CAMERA_DAMPING * delta);
    camera.position.lerp(desiredCameraPosition, cameraBlend);
    cameraTarget.set(
      snapshot.position.x,
      CAMERA_TARGET_HEIGHT,
      snapshot.position.z,
    );
    camera.lookAt(cameraTarget);

    const showPath =
      debugVisible &&
      snapshot.mode === "clickToPoint" &&
      snapshot.isClickTargetConfirmed &&
      snapshot.target !== null;

    if (pathLineRef.current) {
      pathLineRef.current.visible = showPath;
    }

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.visible = showPath;
    }

    if (showPath && snapshot.target && pathGeometryRef.current) {
      pathPositions[0] = snapshot.position.x;
      pathPositions[1] = 0.07;
      pathPositions[2] = snapshot.position.z;
      pathPositions[3] = snapshot.target.x;
      pathPositions[4] = 0.07;
      pathPositions[5] = snapshot.target.z;

      const positionAttribute = pathGeometryRef.current.getAttribute("position");

      if (positionAttribute instanceof BufferAttribute) {
        positionAttribute.needsUpdate = true;
      }

      destinationMarkerRef.current?.position.set(
        snapshot.target.x,
        0.075,
        snapshot.target.z,
      );
    }

    const showSelectedPath = activeTarget !== null;

    if (selectedPathLineRef.current) {
      selectedPathLineRef.current.visible = showSelectedPath;
    }

    if (showSelectedPath && activeTarget && selectedPathGeometryRef.current) {
      selectedPathPositions[0] = snapshot.position.x;
      selectedPathPositions[1] = 0.09;
      selectedPathPositions[2] = snapshot.position.z;
      selectedPathPositions[3] = activeTarget.xMeters;
      selectedPathPositions[4] = 0.09;
      selectedPathPositions[5] = activeTarget.zMeters;

      const positionAttribute = selectedPathGeometryRef.current.getAttribute(
        "position",
      );

      if (positionAttribute instanceof BufferAttribute) {
        positionAttribute.needsUpdate = true;
      }
    }

    if (!debugVisible) {
      wasDebugVisible.current = false;
      return;
    }

    const isFirstVisibleSample = !wasDebugVisible.current;
    const isSampleDue =
      lastDebugSampleAtMs.current === null ||
      timestampMs - lastDebugSampleAtMs.current >= DEBUG_SAMPLE_INTERVAL_MS;

    if (isFirstVisibleSample || isSampleDue) {
      onDebugStatsChange({
        speedMetersPerSecond: snapshot.speedMetersPerSecond,
        ...speedBoost,
        ...combatSnapshot,
      });
      lastDebugSampleAtMs.current = timestampMs;
    }

    wasDebugVisible.current = true;
  });

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

        <OverheadStatus
          ref={overheadStatusRef}
          position={[0, 1.48, 0]}
          healthColor="#74d641"
          showEffects
        />
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
