import type { GroundPoint, ObstacleDefinition } from "./types";

export interface PositionBlocker {
  isPositionBlocked(position: GroundPoint, radiusMeters: number): boolean;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

export function isOutsideArena(
  position: GroundPoint,
  radiusMeters: number,
  arenaHalfSizeMeters: number,
): boolean {
  return (
    Math.abs(position.x) + radiusMeters > arenaHalfSizeMeters ||
    Math.abs(position.z) + radiusMeters > arenaHalfSizeMeters
  );
}

export function circleIntersectsObstacle(
  position: GroundPoint,
  radiusMeters: number,
  obstacle: ObstacleDefinition,
): boolean {
  const halfWidthMeters = obstacle.widthMeters / 2;
  const halfDepthMeters = obstacle.depthMeters / 2;
  const closestX = clamp(
    position.x,
    obstacle.xMeters - halfWidthMeters,
    obstacle.xMeters + halfWidthMeters,
  );
  const closestZ = clamp(
    position.z,
    obstacle.zMeters - halfDepthMeters,
    obstacle.zMeters + halfDepthMeters,
  );
  const distanceX = position.x - closestX;
  const distanceZ = position.z - closestZ;

  return (
    distanceX * distanceX + distanceZ * distanceZ <=
    radiusMeters * radiusMeters
  );
}

export function isPositionBlocked(
  position: GroundPoint,
  radiusMeters: number,
  obstacles: readonly ObstacleDefinition[],
  arenaHalfSizeMeters: number,
): boolean {
  if (isOutsideArena(position, radiusMeters, arenaHalfSizeMeters)) {
    return true;
  }

  return obstacles.some((obstacle) =>
    circleIntersectsObstacle(position, radiusMeters, obstacle),
  );
}
