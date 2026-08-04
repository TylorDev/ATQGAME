import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  type Intersection,
  Plane,
  Raycaster,
  Vector3,
} from "three";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import { CAMERA_WHEEL_ZOOM_STEP_METERS } from "@/game/camera";
import { TEST_DUMMY } from "@/game/constants";
import {
  isEditableEventTarget,
  PLAYER_AREA_KEYBINDING,
  SPEED_BOOST_KEYBINDING,
} from "@/game/keybindings";
import { isGroundProjectionActive } from "@/game/pointerProjection";
import type { GroundPoint } from "@/game/types";

interface BrowserGameInputProps {
  onCameraDistanceChange: (distanceDeltaMeters: number) => void;
}

export function BrowserGameInput({
  onCameraDistanceChange,
}: BrowserGameInputProps) {
  const { input, runtime, targetObjectRef } = useGameRuntimeServices();
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const groundPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const rayIntersection = useMemo(() => new Vector3(), []);
  const targetIntersections = useRef<Intersection[]>([]);

  useEffect(() => {
    const canvas = gl.domElement;

    const updatePointer = (event: PointerEvent): void => {
      const bounds = canvas.getBoundingClientRect();
      input.pointerNdc.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
    };

    const projectPointer = (): GroundPoint | null => {
      raycaster.setFromCamera(input.pointerNdc, camera);
      input.raycastMetrics.ground += 1;
      const hit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);
      return hit ? { x: hit.x, z: hit.z } : null;
    };

    const isPointerOnTarget = (): boolean => {
      const target = targetObjectRef.current;

      if (!target) {
        return false;
      }

      targetIntersections.current.length = 0;
      raycaster.setFromCamera(input.pointerNdc, camera);
      input.raycastMetrics.target += 1;
      raycaster.intersectObject(target, true, targetIntersections.current);
      return targetIntersections.current.length > 0;
    };

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }

      updatePointer(event);

      if (isPointerOnTarget()) {
        event.preventDefault();
        runtime.dispatch({
          type: "activate-target",
          targetId: TEST_DUMMY.id,
        });
        return;
      }

      if (event.button !== 2) {
        return;
      }

      event.preventDefault();
      const point = projectPointer();

      if (!point) {
        return;
      }

      input.pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      const timestampMs = performance.now();
      input.rightPressStartedAtMs = timestampMs;
      input.groundPoint.x = point.x;
      input.groundPoint.z = point.z;
      input.hasGroundHit = true;
      input.hasPendingFacingPoint = true;
      runtime.dispatch({
        type: "start-ground-move",
        point,
        timestampMs,
      });
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (input.pointerId === event.pointerId) {
        updatePointer(event);
      }
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (event.button !== 2 || input.pointerId !== event.pointerId) {
        return;
      }

      updatePointer(event);
      const finalPoint = projectPointer();

      if (finalPoint) {
        input.groundPoint.x = finalPoint.x;
        input.groundPoint.z = finalPoint.z;
        input.hasGroundHit = true;
        input.hasPendingFacingPoint = true;
      }

      runtime.dispatch({
        type: "finish-ground-move",
        timestampMs: performance.now(),
      });

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      input.pointerId = null;
      input.rightPressStartedAtMs = null;
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
      const activePointerId = input.pointerId;

      if (
        activePointerId !== null &&
        canvas.hasPointerCapture(activePointerId)
      ) {
        canvas.releasePointerCapture(activePointerId);
      }

      input.pointerId = null;
      input.rightPressStartedAtMs = null;
      input.hasGroundHit = false;
      input.hasPendingFacingPoint = false;
      runtime.dispatch({ type: "cancel-gameplay-input" });
      runtime.resetFrameAccumulator();
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
    input,
    onCameraDistanceChange,
    rayIntersection,
    raycaster,
    runtime,
    targetObjectRef,
  ]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat || isEditableEventTarget(event.target)) {
        return;
      }

      if (event.code === SPEED_BOOST_KEYBINDING.code) {
        runtime.dispatch({
          type: "activate-ability",
          abilityId: "speed-boost",
        });
        return;
      }

      if (event.code === PLAYER_AREA_KEYBINDING.code) {
        runtime.dispatch({ type: "toggle-player-area" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [runtime]);

  useFrame(() => {
    input.hasGroundHit = input.hasPendingFacingPoint;
    input.hasPendingFacingPoint = false;

    if (!isGroundProjectionActive(input.pointerId)) {
      return;
    }

    raycaster.setFromCamera(input.pointerNdc, camera);
    input.raycastMetrics.ground += 1;
    const hit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);

    if (!hit) {
      return;
    }

    input.hasGroundHit = true;
    input.groundPoint.x = hit.x;
    input.groundPoint.z = hit.z;
    runtime.dispatch({
      type: "steer-ground-move",
      point: input.groundPoint,
    });
  }, GAME_FRAME_PRIORITY.input);

  return null;
}
