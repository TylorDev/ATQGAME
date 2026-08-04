import { PLAYER_RADIUS_METERS } from "../constants";
import { circleIntersectsGroundHazard } from "../hazards";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import {
  DEATH_NOTICE_DURATION_MS,
  type WorldState,
} from "../core/WorldState";

export class HazardSystem implements GameSystem {
  readonly id = "hazard";

  step(world: WorldState, context: FixedStepContext): void {
    const definition = world.burningHazardDefinition;
    const isInside = circleIntersectsGroundHazard(
      world.player.currentPosition,
      PLAYER_RADIUS_METERS,
      definition,
    );
    const hazard = world.burningHazard.step(
      context.deltaSeconds,
      isInside,
      definition.tickIntervalSeconds,
    );
    world.player.isBurning = hazard.isActive;

    for (let tick = 0; tick < hazard.damageTicks; tick += 1) {
      const result = world.player.vitality.applyDamage(
        definition.damagePerTick,
      );
      context.events.push({
        type: "vitality-change",
        receiverId: world.player.id,
        healthDelta: result.appliedDamage > 0 ? -result.appliedDamage : 0,
      });

      if (result.appliedDamage > 0) {
        context.events.push({
          type: "damage",
          payload: {
            occurredAtMs:
              world.wallClockOffsetMs + world.simulationTimeMs,
            appliedDamage: result.appliedDamage,
            receiver: {
              id: world.player.id,
              kind: "player",
              displayName: world.player.name,
            },
            source: {
              id: definition.id,
              kind: "entity",
              displayName: definition.displayName,
            },
          },
        });
      }

      if (result.didDie) {
        context.events.push({
          type: "vitality-change",
          receiverId: world.player.id,
          healthDelta: result.snapshot.currentHealth,
        });
        world.player.deathNoticeUntilMs =
          world.simulationTimeMs + DEATH_NOTICE_DURATION_MS;
        context.markCriticalUiChange();
      }
    }
  }
}
