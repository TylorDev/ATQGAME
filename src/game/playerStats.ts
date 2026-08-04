import { PLAYER_BASE_SPEED_METERS_PER_SECOND } from "./constants";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "./combat";
import { BURNING_EFFECT } from "./hazards";
import { getEffectTimerProgress } from "./overheadStatus";
import type {
  ActiveEffect,
  PlayerCombatSnapshot,
  PlayerHudState,
} from "./types";

export const SPEED_BOOST_MULTIPLIER = 1.8;
export const SPEED_BOOST_DURATION_MS = 5_000;
export const SPEED_BOOST_COOLDOWN_MS = 15_000;

export interface SpeedModifier {
  id: string;
  multiplier: number;
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

  activate(timestampMs: number): boolean {
    if (this.getSnapshot(timestampMs).cooldownRemainingMs > 0) {
      return false;
    }

    this.activatedAtMs = timestampMs;
    return true;
  }

  getSnapshot(timestampMs: number): SpeedBoostSnapshot {
    if (this.activatedAtMs === null) {
      return {
        isActive: false,
        durationRemainingMs: 0,
        cooldownRemainingMs: 0,
      };
    }

    const elapsedMs = Math.max(0, timestampMs - this.activatedAtMs);
    const durationRemainingMs = Math.max(SPEED_BOOST_DURATION_MS - elapsedMs, 0);
    const cooldownRemainingMs = Math.max(SPEED_BOOST_COOLDOWN_MS - elapsedMs, 0);

    return {
      isActive: durationRemainingMs > 0,
      durationRemainingMs,
      cooldownRemainingMs,
    };
  }
}

export function getCurrentPlayerSpeedMetersPerSecond(
  speedBoost: SpeedBoostSnapshot,
): number {
  return calculateMovementSpeedMetersPerSecond(
    PLAYER_BASE_SPEED_METERS_PER_SECOND,
    speedBoost.isActive ? [SPEED_BOOST_MODIFIER] : [],
  );
}

export function getActivePlayerEffects(
  speedBoost: SpeedBoostSnapshot,
  isBurning: boolean,
): readonly ActiveEffect[] {
  const effects: ActiveEffect[] = [];

  if (speedBoost.isActive) {
    effects.push({
      ...SPEED_BOOST_EFFECT,
      timerProgress: getEffectTimerProgress(
        speedBoost.durationRemainingMs,
        SPEED_BOOST_DURATION_MS,
      ),
    });
  }

  if (isBurning) {
    effects.push(BURNING_EFFECT);
  }

  return effects;
}
