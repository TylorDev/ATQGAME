import type { FixedStepContext } from "./GameSystem";
import type { WorldState } from "./WorldState";

export function activateTarget(
  world: WorldState,
  context: FixedStepContext,
): void {
  const wasSelected = world.target.selected;
  world.target.selected = true;
  world.target.pursuitActive = true;
  world.player.movement.resumeFollowTarget(
    world.target.position,
    world.autoAttackRangeMeters,
  );

  if (!wasSelected) {
    context.events.push({ type: "target-selected" });
  }

  context.markCriticalUiChange();
}

export function deselectTarget(
  world: WorldState,
  context: FixedStepContext,
): void {
  if (!world.target.selected) {
    return;
  }

  world.target.selected = false;
  world.target.pursuitActive = false;
  world.player.movement.clearFollowTarget();
  context.events.push({ type: "target-deselected" });
  context.markCriticalUiChange();
}
