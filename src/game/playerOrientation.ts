import { MIN_DIRECTION_LENGTH_METERS } from "./constants";
import type { GroundPoint } from "./types";

export function resolvePointerFacingYaw(
  currentYaw: number,
  isPointerActive: boolean,
  origin: GroundPoint,
  pointerGroundPoint: GroundPoint,
  minimumDirectionLengthMeters = MIN_DIRECTION_LENGTH_METERS,
): number {
  if (!isPointerActive) {
    return currentYaw;
  }

  const directionX = pointerGroundPoint.x - origin.x;
  const directionZ = pointerGroundPoint.z - origin.z;
  const minimumLength = Math.max(minimumDirectionLengthMeters, 0);

  if (
    directionX * directionX + directionZ * directionZ <=
    minimumLength * minimumLength
  ) {
    return currentYaw;
  }

  return Math.atan2(directionX, directionZ);
}
