import { isWithinAutoAttackRange } from "../testDummy";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class AutoAttackSystem implements GameSystem {
  readonly id = "auto-attack";

  step(world: WorldState, context: FixedStepContext): void {
    const canAttack =
      world.target.selected &&
      !world.target.controller.isDefeated() &&
      isWithinAutoAttackRange(
        world.player.currentPosition,
        world.target.position,
      );
    const attacks = world.target.autoAttack.step(
      context.deltaSeconds,
      canAttack,
    );

    for (let attack = 0; attack < attacks; attack += 1) {
      const result = world.target.controller.applyDamage(
        world.target.autoAttack.getDamagePerAttack(),
        world.simulationTimeMs,
        world.target.damageResult,
      );
      context.events.push({
        type: "vitality-change",
        receiverId: world.target.definition.id,
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
              id: world.target.definition.id,
              kind: "test-dummy",
              displayName: world.target.definition.displayName,
            },
            source: {
              id: world.player.id,
              kind: "player",
              displayName: world.player.name,
            },
          },
        });
      }

      if (result.didDefeat) {
        context.markCriticalUiChange();
      }
    }
  }
}
