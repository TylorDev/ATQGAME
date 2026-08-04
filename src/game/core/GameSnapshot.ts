import type { PlayerDebugStats } from "../playerStats";
import type { PlayerHudState, TestDummySnapshot } from "../types";
import type { WorldState } from "./WorldState";

export const UI_PUBLISH_INTERVAL_MS = 100;

export interface GameUiSnapshot {
  readonly playerHud: PlayerHudState;
  readonly testDummy: TestDummySnapshot;
  readonly debug: PlayerDebugStats;
  readonly targetSelected: boolean;
}

export function createGameUiSnapshot(
  world: WorldState,
): GameUiSnapshot {
  const combat = world.player.vitality.getSnapshot();
  const speed = world.player.speedBoost.getSnapshot(world.simulationTimeMs);
  const movement = world.player.movement.getSnapshot();

  return {
    playerHud: {
      currentHealth: combat.currentHealth,
      maximumHealth: combat.maximumHealth,
      defensePercent: combat.defensePercent,
      activeEffects: world.player.effects.map((effect) => ({ ...effect })),
      isDeathNoticeVisible:
        world.simulationTimeMs < world.player.deathNoticeUntilMs,
    },
    testDummy: world.target.controller.writeSnapshot(),
    debug: {
      speedMetersPerSecond:
        movement.speedMetersPerSecond,
      isActive: speed.isActive,
      durationRemainingMs: speed.durationRemainingMs,
      cooldownRemainingMs: speed.cooldownRemainingMs,
      currentHealth: combat.currentHealth,
      maximumHealth: combat.maximumHealth,
      defensePercent: combat.defensePercent,
    },
    targetSelected: world.target.selected,
  };
}
