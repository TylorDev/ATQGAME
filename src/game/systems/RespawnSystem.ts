import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class RespawnSystem implements GameSystem {
  readonly id = "respawn";

  step(world: WorldState, context: FixedStepContext): void {
    const didRespawn = world.target.controller.step(
      context.deltaSeconds,
      world.simulationTimeMs,
    );

    if (!didRespawn) {
      return;
    }

    context.events.push({
      type: "vitality-change",
      receiverId: world.target.definition.id,
      healthDelta: world.target.definition.maximumHealth,
    });
    context.markCriticalUiChange();
  }
}
