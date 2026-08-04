import {
  PLAYER_AREA_RADIUS_METERS,
  playerAreaTouchesTarget,
} from "../playerArea";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class PlayerAreaSystem implements GameSystem {
  readonly id = "player-area";

  step(world: WorldState, context: FixedStepContext): void {
    if (!world.player.areaActive) {
      return;
    }

    const isInside = playerAreaTouchesTarget(
      world.player.currentPosition,
      world.target.position,
      world.target.definition.footprintRadiusMeters,
    );
    context.events.push({
      type: "area-presence",
      payload: {
        occurredAtMs: world.wallClockOffsetMs + world.simulationTimeMs,
        target: {
          id: world.target.definition.id,
          kind: "test-dummy",
          displayName: world.target.definition.displayName,
        },
        status: isInside ? "inside" : "outside",
        areaRadiusMeters: PLAYER_AREA_RADIUS_METERS,
      },
    });
  }
}
