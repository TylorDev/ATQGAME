import type { MovementStateView } from "../MovementController";
import type { TestDummyStateView } from "../testDummy";
import type {
  ActiveEffect,
  GroundPoint,
  PlayerCombatSnapshot,
} from "../types";
import type { PerformanceLoadState } from "./PerformanceLoadState";
import type { WorldState } from "./WorldState";

export interface RenderFrame {
  readonly movement: MovementStateView;
  readonly previousPlayerPosition: GroundPoint;
  readonly currentPlayerPosition: GroundPoint;
  readonly interpolatedPlayerPosition: GroundPoint;
  readonly playerCombat: PlayerCombatSnapshot;
  readonly playerEffects: readonly ActiveEffect[];
  readonly testDummy: TestDummyStateView;
  readonly targetPosition: GroundPoint;
  readonly performanceLoad: PerformanceLoadState | null;
  interpolationAlpha: number;
  playerAreaActive: boolean;
  targetSelected: boolean;
  targetPursuitActive: boolean;
  simulationTimeMs: number;
}

export function createRenderFrame(world: WorldState): RenderFrame {
  return {
    movement: world.player.movement.getState(),
    previousPlayerPosition: world.player.previousPosition,
    currentPlayerPosition: world.player.currentPosition,
    interpolatedPlayerPosition: { ...world.player.currentPosition },
    playerCombat: world.player.vitality.getState(),
    playerEffects: world.player.effects,
    testDummy: world.target.controller.getState(world.simulationTimeMs),
    targetPosition: world.target.position,
    performanceLoad: world.performanceLoad,
    interpolationAlpha: 0,
    playerAreaActive: world.player.areaActive,
    targetSelected: world.target.selected,
    targetPursuitActive: world.target.pursuitActive,
    simulationTimeMs: world.simulationTimeMs,
  };
}

export function syncRenderFrame(
  frame: RenderFrame,
  world: WorldState,
  interpolationAlpha: number,
): void {
  frame.interpolationAlpha = interpolationAlpha;
  frame.interpolatedPlayerPosition.x =
    world.player.previousPosition.x +
    (world.player.currentPosition.x - world.player.previousPosition.x) *
      interpolationAlpha;
  frame.interpolatedPlayerPosition.z =
    world.player.previousPosition.z +
    (world.player.currentPosition.z - world.player.previousPosition.z) *
      interpolationAlpha;
  frame.playerAreaActive = world.player.areaActive;
  frame.targetSelected = world.target.selected;
  frame.targetPursuitActive = world.target.pursuitActive;
  frame.simulationTimeMs = world.simulationTimeMs;
}
