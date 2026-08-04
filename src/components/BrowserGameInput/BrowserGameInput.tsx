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
import { useInputRouter } from "@/contexts/InputRouterContext";
import { CAMERA_WHEEL_ZOOM_STEP_METERS } from "@/game/camera";
import { TEST_DUMMY } from "@/game/constants";
import { isGroundProjectionActive } from "@/game/pointerProjection";
import type { GroundPoint } from "@/game/types";

export function BrowserGameInput() {
  const { input, targetObjectRef } = useGameRuntimeServices();
  const router = useInputRouter();
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const groundPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), 0),
    [],
  );
  const rayIntersection = useMemo(() => new Vector3(), []);
  const targetIntersections = useRef<Intersection[]>([]);
  const projectedPoint = useRef<GroundPoint>({ x: 0, z: 0 });
  const suppressContextMenuRef = useRef(false);

  useEffect(() => {
    const canvas = gl.domElement;

    const updatePointer = (event: PointerEvent): void => {
      const bounds = canvas.getBoundingClientRect();
      input.pointerNdc.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
    };

    const projectPointer = (output: GroundPoint): boolean => {
      raycaster.setFromCamera(input.pointerNdc, camera);
      input.raycastMetrics.ground += 1;
      const hit = raycaster.ray.intersectPlane(groundPlane, rayIntersection);
      if (!hit) return false;
      output.x = hit.x;
      output.z = hit.z;
      return true;
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
        const consumed = router.dispatch({
          type: "activate-target",
          targetId: TEST_DUMMY.id,
        });
        suppressContextMenuRef.current = event.button === 2 && consumed;
        if (consumed) event.preventDefault();
        return;
      }

      if (event.button !== 2) {
        return;
      }

      const point = projectedPoint.current;

      if (!projectPointer(point)) {
        return;
      }

      const timestampMs = performance.now();
      const consumed = router.dispatch({
        type: "start-ground-move",
        point,
        timestampMs,
      });
      suppressContextMenuRef.current = consumed;
      if (!consumed) return;

      event.preventDefault();
      input.pointerId = event.pointerId;
      canvas.setPointerCapture(event.pointerId);
      input.rightPressStartedAtMs = timestampMs;
      input.groundPoint.x = point.x;
      input.groundPoint.z = point.z;
      input.hasGroundHit = true;
      input.hasPendingFacingPoint = true;
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
      const finalPoint = projectedPoint.current;

      if (projectPointer(finalPoint)) {
        input.groundPoint.x = finalPoint.x;
        input.groundPoint.z = finalPoint.z;
        input.hasGroundHit = true;
        input.hasPendingFacingPoint = true;
      }

      const consumed = router.dispatch({
        type: "finish-ground-move",
        timestampMs: performance.now(),
      });
      if (consumed) event.preventDefault();

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      input.pointerId = null;
      input.rightPressStartedAtMs = null;
    };

    const handleContextMenu = (event: MouseEvent): void => {
      if (suppressContextMenuRef.current) event.preventDefault();
      suppressContextMenuRef.current = false;
    };

    const handleWheel = (event: WheelEvent): void => {
      const direction = Math.sign(event.deltaY);

      if (direction === 0) {
        return;
      }

      if (router.dispatch({
        type: "camera-zoom",
        deltaMeters: direction * CAMERA_WHEEL_ZOOM_STEP_METERS,
      })) event.preventDefault();
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
    };

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("contextmenu", handleContextMenu);
    const unsubscribeCancel = router.subscribe("global", (action) => {
      if (action.type !== "cancel-gameplay") return false;
      cancelInput();
      return true;
    });

    return () => {
      cancelInput();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("contextmenu", handleContextMenu);
      unsubscribeCancel();
    };
  }, [
    camera,
    gl,
    groundPlane,
    input,
    projectedPoint,
    rayIntersection,
    raycaster,
    router,
    targetObjectRef,
  ]);

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
    router.dispatch({
      type: "steer-ground-move",
      point: input.groundPoint,
    });
  }, GAME_FRAME_PRIORITY.input);

  return null;
}
