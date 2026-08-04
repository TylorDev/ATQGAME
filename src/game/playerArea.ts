import type { GroundPoint } from "./types";

export const PLAYER_AREA_RADIUS_METERS = 10;
export const PLAYER_AREA_BORDER_THICKNESS_METERS = 0.1;

/**
 * Tests horizontal circle contact using squared meters so the exact boundary
 * remains inclusive without paying for a square root on every simulation tick.
 */
export function playerAreaTouchesTarget(
  playerPosition: GroundPoint,
  targetPosition: GroundPoint,
  targetRadiusMeters: number,
): boolean {
  const contactRadiusMeters =
    PLAYER_AREA_RADIUS_METERS + targetRadiusMeters;
  const contactRadiusSquared = contactRadiusMeters * contactRadiusMeters;
  const distanceX = targetPosition.x - playerPosition.x;
  const distanceZ = targetPosition.z - playerPosition.z;
  const distanceSquared = distanceX * distanceX + distanceZ * distanceZ;
  const inclusiveTolerance =
    Number.EPSILON * Math.max(contactRadiusSquared, 1) * 4;

  return distanceSquared <= contactRadiusSquared + inclusiveTolerance;
}
