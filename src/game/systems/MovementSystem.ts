import { getCurrentPlayerSpeedMetersPerSecond } from "../playerStats";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class MovementSystem implements GameSystem {
  readonly id = "movement";

  step(world: WorldState, context: FixedStepContext): void {
    const movementBefore = world.player.movement.getState();
    world.player.previousPosition.x = movementBefore.position.x;
    world.player.previousPosition.z = movementBefore.position.z;
    const boost = world.player.speedBoost.update(world.simulationTimeMs);
    world.player.movement.step(
      context.deltaSeconds,
      world.simulationTimeMs,
      world.obstacleIndex,
      getCurrentPlayerSpeedMetersPerSecond(boost),
    );
    const movementAfter = world.player.movement.getState();
    world.player.currentPosition.x = movementAfter.position.x;
    world.player.currentPosition.z = movementAfter.position.z;
  }
}
