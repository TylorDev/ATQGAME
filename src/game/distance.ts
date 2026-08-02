import type { GroundPoint } from "./types";

/** Returns the horizontal distance between two ground points in meters. */
export function calculateGroundDistanceMeters(
  from: GroundPoint,
  to: GroundPoint,
): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}
