import { PLAYER_BASE_SPEED_METERS_PER_SECOND } from "./constants";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "./combat";
import type {
  ActiveEffect,
  PlayerCombatSnapshot,
  PlayerHudState,
} from "./types";

export const SPEED_BOOST_MULTIPLIER = 1.8;
export const SPEED_BOOST_DURATION_MS = 5_000;
export const SPEED_BOOST_COOLDOWN_MS = 15_000;

export interface SpeedModifier {
  readonly id: string;
  readonly multiplier: number;
}

export interface SpeedBoostSnapshot {
  isActive: boolean;
  durationRemainingMs: number;
  cooldownRemainingMs: number;
}

export interface PlayerDebugStats
  extends SpeedBoostSnapshot,
    PlayerCombatSnapshot {
  speedMetersPerSecond: number;
}

export const SPEED_BOOST_MODIFIER: Readonly<SpeedModifier> = {
  id: "speed-boost",
  multiplier: SPEED_BOOST_MULTIPLIER,
};

export const SPEED_BOOST_EFFECT: Readonly<ActiveEffect> = {
  id: "speed-boost",
  kind: "buff",
  name: "Impulso",
  description: "Velocidad de movimiento aumentada un 80%.",
  timerProgress: 0,
};

export const DEFAULT_PLAYER_DEBUG_STATS: Readonly<PlayerDebugStats> = {
  speedMetersPerSecond: 0,
  isActive: false,
  durationRemainingMs: 0,
  cooldownRemainingMs: 0,
  currentHealth: DEFAULT_PLAYER_COMBAT_SETTINGS.maximumHealth,
  maximumHealth: DEFAULT_PLAYER_COMBAT_SETTINGS.maximumHealth,
  defensePercent: 0,
};

export const DEFAULT_PLAYER_HUD_STATE: Readonly<PlayerHudState> = {
  currentHealth: DEFAULT_PLAYER_COMBAT_SETTINGS.maximumHealth,
  maximumHealth: DEFAULT_PLAYER_COMBAT_SETTINGS.maximumHealth,
  defensePercent: 0,
  activeEffects: [],
  isDeathNoticeVisible: false,
};

export function calculateMovementSpeedMetersPerSecond(
  baseSpeedMetersPerSecond: number,
  modifiers: readonly SpeedModifier[],
): number {
  const multiplier = modifiers.reduce(
    (currentMultiplier, modifier) => currentMultiplier * modifier.multiplier,
    1,
  );

  return Math.max(0, baseSpeedMetersPerSecond * multiplier);
}

export class SpeedBoostController {
  private activatedAtMs: number | null = null;
  private readonly state: SpeedBoostSnapshot = {
    isActive: false,
    durationRemainingMs: 0,
    cooldownRemainingMs: 0,
  };

  activate(timestampMs: number): boolean {
    this.sync(timestampMs);

    if (this.state.cooldownRemainingMs > 0) {
      return false;
    }

    this.activatedAtMs = timestampMs;
    return true;
  }

  getSnapshot(timestampMs: number): SpeedBoostSnapshot {
    return this.writeSnapshot(timestampMs);
  }

  writeSnapshot(
    timestampMs: number,
    output: SpeedBoostSnapshot = {
      isActive: false,
      durationRemainingMs: 0,
      cooldownRemainingMs: 0,
    },
  ): SpeedBoostSnapshot {
    this.sync(timestampMs);
    output.isActive = this.state.isActive;
    output.durationRemainingMs = this.state.durationRemainingMs;
    output.cooldownRemainingMs = this.state.cooldownRemainingMs;
    return output;
  }

  private sync(timestampMs: number): void {
    if (this.activatedAtMs === null) {
      this.state.isActive = false;
      this.state.durationRemainingMs = 0;
      this.state.cooldownRemainingMs = 0;
      return;
    }

    const elapsedMs = Math.max(0, timestampMs - this.activatedAtMs);
    const durationRemainingMs = Math.max(SPEED_BOOST_DURATION_MS - elapsedMs, 0);
    const cooldownRemainingMs = Math.max(SPEED_BOOST_COOLDOWN_MS - elapsedMs, 0);

    this.state.isActive = durationRemainingMs > 0;
    this.state.durationRemainingMs = durationRemainingMs;
    this.state.cooldownRemainingMs = cooldownRemainingMs;
  }
}

export function getCurrentPlayerSpeedMetersPerSecond(
  speedBoost: SpeedBoostSnapshot,
): number {
  return Math.max(
    0,
    PLAYER_BASE_SPEED_METERS_PER_SECOND *
      (speedBoost.isActive ? SPEED_BOOST_MULTIPLIER : 1),
  );
}
