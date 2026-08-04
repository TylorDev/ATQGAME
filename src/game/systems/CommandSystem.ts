import { PLAYER_AREA_RADIUS_METERS } from "../playerArea";
import type { GameplayAction } from "../core/GameplayAction";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";
import { activateTarget } from "../core/WorldTransitions";

interface GameActionHandler {
  handle(
    action: GameplayAction,
    world: WorldState,
    context: FixedStepContext,
  ): boolean;
}

class MovementActionHandler implements GameActionHandler {
  handle(action: GameplayAction, world: WorldState): boolean {
    switch (action.type) {
      case "start-ground-move":
        world.player.movement.pauseFollowTarget();
        world.target.pursuitActive = false;
        world.player.movement.beginRightPress(
          action.point,
          action.timestampMs,
        );
        return true;
      case "steer-ground-move":
        world.player.movement.updatePointerGround(action.point);
        return true;
      case "finish-ground-move":
        world.player.movement.endRightPress(action.timestampMs);
        return true;
      case "cancel-gameplay-input":
        world.player.movement.cancelInput();
        return true;
      default:
        return false;
    }
  }
}

class PlayerActionHandler implements GameActionHandler {
  handle(
    action: GameplayAction,
    world: WorldState,
    context: FixedStepContext,
  ): boolean {
    switch (action.type) {
      case "activate-ability":
        world.player.speedBoost.activate(world.simulationTimeMs);
        return true;
      case "toggle-player-area":
        world.player.areaActive = !world.player.areaActive;

        if (!world.player.areaActive) {
          context.events.push({
            type: "area-presence",
            payload: {
              occurredAtMs:
                world.wallClockOffsetMs + world.simulationTimeMs,
              target: {
                id: world.target.definition.id,
                kind: "test-dummy",
                displayName: world.target.definition.displayName,
              },
              status: "deactivated",
              areaRadiusMeters: PLAYER_AREA_RADIUS_METERS,
            },
          });
        }
        return true;
      case "update-player-combat-settings":
        world.player.vitality.updateSettings(action.settings);
        context.markCriticalUiChange();
        return true;
      case "update-player-name":
        world.player.name = action.playerName;
        return true;
      default:
        return false;
    }
  }
}

class TargetActionHandler implements GameActionHandler {
  handle(
    action: GameplayAction,
    world: WorldState,
    context: FixedStepContext,
  ): boolean {
    if (action.type !== "activate-target") {
      return false;
    }

    if (action.targetId === world.target.definition.id) {
      activateTarget(world, context);
    }

    return true;
  }
}

export class CommandSystem implements GameSystem {
  readonly id = "commands";
  private readonly handlers: readonly GameActionHandler[] = [
    new MovementActionHandler(),
    new PlayerActionHandler(),
    new TargetActionHandler(),
  ];

  step(world: WorldState, context: FixedStepContext): void {
    context.commands.drain((action) => {
      for (let index = 0; index < this.handlers.length; index += 1) {
        if (this.handlers[index].handle(action, world, context)) {
          return;
        }
      }
    });
  }
}
