import type { ActiveEffect, GroundHazardDefinition, GroundPoint } from "./types";

export const BURNING_EFFECT: Readonly<ActiveEffect> = {
  id: "burning",
  kind: "debuff",
  name: "Ardiendo",
  description:
    "El suelo abrasador inflige 100 de daño base cada 2 s. La defensa reduce el daño.",
};

export interface BurningHazardSnapshot {
  isActive: boolean;
  damageTicks: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

export function circleIntersectsGroundHazard(
  position: GroundPoint,
  radiusMeters: number,
  hazard: GroundHazardDefinition,
): boolean {
  const halfWidthMeters = hazard.widthMeters / 2;
  const halfDepthMeters = hazard.depthMeters / 2;
  const closestX = clamp(
    position.x,
    hazard.xMeters - halfWidthMeters,
    hazard.xMeters + halfWidthMeters,
  );
  const closestZ = clamp(
    position.z,
    hazard.zMeters - halfDepthMeters,
    hazard.zMeters + halfDepthMeters,
  );
  const distanceX = position.x - closestX;
  const distanceZ = position.z - closestZ;

  return distanceX * distanceX + distanceZ * distanceZ <= radiusMeters * radiusMeters;
}

export class BurningHazardController {
  private elapsedInsideSeconds = 0;
  private isActive = false;

  step(
    deltaSeconds: number,
    isInsideHazard: boolean,
    tickIntervalSeconds: number,
  ): BurningHazardSnapshot {
    if (!isInsideHazard) {
      this.elapsedInsideSeconds = 0;
      this.isActive = false;

      return { isActive: false, damageTicks: 0 };
    }

    this.isActive = true;
    this.elapsedInsideSeconds += Math.max(deltaSeconds, 0);
    const damageTicks = Math.floor(
      this.elapsedInsideSeconds / tickIntervalSeconds,
    );
    this.elapsedInsideSeconds -= damageTicks * tickIntervalSeconds;

    return { isActive: this.isActive, damageTicks };
  }

  getSnapshot(): BurningHazardSnapshot {
    return { isActive: this.isActive, damageTicks: 0 };
  }
}
