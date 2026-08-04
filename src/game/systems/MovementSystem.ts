import { getCurrentPlayerSpeedMetersPerSecond } from "../playerStats";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class MovementSystem implements GameSystem {
  readonly id = "movement";

  step(world: WorldState, context: FixedStepContext): void {
    world.player.movement.writePosition(world.player.previousPosition);
    const boost = world.player.speedBoost.writeSnapshot(
      world.simulationTimeMs,
      world.player.speedBoostSnapshot,
    );
    world.player.movement.step(
      context.deltaSeconds,
      world.simulationTimeMs,
      world.obstacleIndex,
      getCurrentPlayerSpeedMetersPerSecond(boost),
    );
    world.player.movement.writePosition(world.player.currentPosition);
  }
}
