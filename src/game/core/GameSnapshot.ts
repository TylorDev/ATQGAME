import type { PlayerDebugStats } from "../playerStats";
import type { PlayerHudState, TestDummySnapshot } from "../types";
import type { WorldState } from "./WorldState";

export const UI_PUBLISH_INTERVAL_MS = 100;

export const enum GameUiSnapshotMask {
  Player = 1,
  Target = 2,
  Debug = 4,
  All = Player | Target | Debug,
}

export interface GameUiSnapshot {
  readonly mask: GameUiSnapshotMask;
  readonly playerHud: PlayerHudState;
  readonly testDummy: TestDummySnapshot;
  readonly debug: PlayerDebugStats;
  readonly targetSelected: boolean;
}

export function createGameUiSnapshot(
  world: WorldState,
  mask: GameUiSnapshotMask,
): GameUiSnapshot {
  const combat = world.player.vitality.getState();
  const speed = world.player.speedBoost.update(world.simulationTimeMs);

  return {
    mask,
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
        world.player.movement.getState().speedMetersPerSecond,
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
