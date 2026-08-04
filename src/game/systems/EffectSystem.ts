import { SPEED_BOOST_DURATION_MS } from "../playerStats";
import { getEffectTimerProgress } from "../overheadStatus";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class EffectSystem implements GameSystem {
  readonly id = "effects";

  step(world: WorldState, context: FixedStepContext): void {
    const boost = world.player.speedBoost.writeSnapshot(
      world.simulationTimeMs,
      world.player.speedBoostSnapshot,
    );
    let effectsMask = 0;
    world.player.effects.length = 0;

    if (boost.isActive) {
      world.player.speedBoostEffect.timerProgress = getEffectTimerProgress(
        boost.durationRemainingMs,
        SPEED_BOOST_DURATION_MS,
      );
      world.player.effects.push(world.player.speedBoostEffect);
      effectsMask |= 1;
    }

    if (world.player.isBurning) {
      world.player.effects.push(world.player.burningEffect);
      effectsMask |= 2;
    }

    if (effectsMask !== world.player.previousEffectsMask) {
      world.player.previousEffectsMask = effectsMask;
      context.markCriticalUiChange();
    }
  }
}
