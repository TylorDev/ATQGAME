import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import {
  calculateCameraOffset,
  CAMERA_TARGET_HEIGHT,
  type CameraSettings,
} from "@/game/camera";
import { CAMERA_DAMPING } from "@/game/constants";
import { createPlayerRenderBuffer } from "@/game/core/GameRenderReader";

interface ThirdPersonCameraProps {
  settings: CameraSettings;
}

export function ThirdPersonCamera({ settings }: ThirdPersonCameraProps) {
  const { runtime } = useGameRuntimeServices();
  const { camera } = useThree();
  const cameraOffset = useMemo(() => {
    const offset = calculateCameraOffset(settings);
    return new Vector3(offset.x, offset.y, offset.z);
  }, [settings.distance, settings.pitchDegrees]);
  const desiredPosition = useMemo(() => new Vector3(), []);
  const cameraTarget = useMemo(() => new Vector3(), []);
  const renderBuffer = useMemo(() => createPlayerRenderBuffer(), []);

  useEffect(() => {
    runtime.renderReader.writePlayer(renderBuffer);
    const position = renderBuffer.interpolatedPosition;
    camera.position.set(
      position.x + cameraOffset.x,
      cameraOffset.y,
      position.z + cameraOffset.z,
    );
    camera.lookAt(position.x, CAMERA_TARGET_HEIGHT, position.z);
  }, [camera, cameraOffset, renderBuffer, runtime]);

  useFrame((_, delta) => {
    runtime.renderReader.writePlayer(renderBuffer);
    const position = renderBuffer.interpolatedPosition;
    desiredPosition.set(position.x, 0, position.z).add(cameraOffset);
    const cameraBlend = 1 - Math.exp(-CAMERA_DAMPING * delta);
    camera.position.lerp(desiredPosition, cameraBlend);
    cameraTarget.set(position.x, CAMERA_TARGET_HEIGHT, position.z);
    camera.lookAt(cameraTarget);
  }, GAME_FRAME_PRIORITY.camera);

  return null;
}
