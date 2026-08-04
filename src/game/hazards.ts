import type { ActiveEffect, GroundHazardDefinition, GroundPoint } from "./types";

export const BURNING_EFFECT: Readonly<ActiveEffect> = {
  id: "burning",
  kind: "debuff",
  name: "Ardiendo",
  description:
    "El suelo abrasador inflige 100 de daño base cada 2 s. La defensa reduce el daño.",
  timerProgress: 1,
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
  private readonly state: BurningHazardSnapshot = {
    isActive: false,
    damageTicks: 0,
  };

  step(
    deltaSeconds: number,
    isInsideHazard: boolean,
    tickIntervalSeconds: number,
  ): BurningHazardSnapshot {
    this.state.damageTicks = 0;

    if (!isInsideHazard) {
      this.elapsedInsideSeconds = 0;
      this.state.isActive = false;
      return this.state;
    }

    this.state.isActive = true;
    this.elapsedInsideSeconds += Math.max(deltaSeconds, 0);
    this.state.damageTicks = Math.floor(
      this.elapsedInsideSeconds / tickIntervalSeconds,
    );
    this.elapsedInsideSeconds -=
      this.state.damageTicks * tickIntervalSeconds;

    return this.state;
  }

  getSnapshot(): BurningHazardSnapshot {
    return { isActive: this.state.isActive, damageTicks: 0 };
  }

  getState(): BurningHazardSnapshot {
    return this.state;
  }
}
