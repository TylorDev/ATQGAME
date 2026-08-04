import { TARGET_DESELECT_DISTANCE_METERS } from "../constants";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";
import { deselectTarget } from "../core/WorldTransitions";

export class TargetingSystem implements GameSystem {
  readonly id = "targeting";

  step(world: WorldState, context: FixedStepContext): void {
    if (!world.target.selected) {
      return;
    }

    const targetDistance = Math.hypot(
      world.player.currentPosition.x - world.target.position.x,
      world.player.currentPosition.z - world.target.position.z,
    );

    if (targetDistance >= TARGET_DESELECT_DISTANCE_METERS) {
      deselectTarget(world, context);
    }
  }
}
