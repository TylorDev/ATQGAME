import type { PlayerCombatSettings, PlayerCombatSnapshot } from "./types";

export const PLAYER_MAXIMUM_HEALTH_MIN = 100;
export const PLAYER_MAXIMUM_HEALTH_MAX = 5_000;
export const PLAYER_MAXIMUM_HEALTH_STEP = 100;
export const PLAYER_DEFENSE_PERCENT_MIN = 0;
export const PLAYER_DEFENSE_PERCENT_MAX = 100;
export const PLAYER_DEFENSE_PERCENT_STEP = 1;

export const DEFAULT_PLAYER_COMBAT_SETTINGS: Readonly<PlayerCombatSettings> = {
  maximumHealth: 1_000,
  defensePercent: 0,
};

export interface DamageResult {
  effectiveDamage: number;
  didDie: boolean;
  snapshot: PlayerCombatSnapshot;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function normalizeMaximumHealth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYER_COMBAT_SETTINGS.maximumHealth;
  }

  return Math.round(
    clamp(value, PLAYER_MAXIMUM_HEALTH_MIN, PLAYER_MAXIMUM_HEALTH_MAX),
  );
}

function normalizeDefensePercent(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PLAYER_COMBAT_SETTINGS.defensePercent;
  }

  return Math.round(
    clamp(
      value,
      PLAYER_DEFENSE_PERCENT_MIN,
      PLAYER_DEFENSE_PERCENT_MAX,
    ),
  );
}

export function normalizePlayerCombatSettings(
  settings: PlayerCombatSettings,
): PlayerCombatSettings {
  return {
    maximumHealth: normalizeMaximumHealth(settings.maximumHealth),
    defensePercent: normalizeDefensePercent(settings.defensePercent),
  };
}

export class PlayerVitalityController {
  private settings: PlayerCombatSettings;
  private currentHealth: number;

  constructor(settings: PlayerCombatSettings = DEFAULT_PLAYER_COMBAT_SETTINGS) {
    this.settings = normalizePlayerCombatSettings(settings);
    this.currentHealth = this.settings.maximumHealth;
  }

  updateSettings(settings: PlayerCombatSettings): PlayerCombatSnapshot {
    this.settings = normalizePlayerCombatSettings(settings);
    this.currentHealth = Math.min(this.currentHealth, this.settings.maximumHealth);

    return this.getSnapshot();
  }

  applyDamage(baseDamage: number): DamageResult {
    const safeBaseDamage = Number.isFinite(baseDamage)
      ? Math.max(0, baseDamage)
      : 0;
    const effectiveDamage = safeBaseDamage * (1 - this.settings.defensePercent / 100);
    const remainingHealth = Math.max(this.currentHealth - effectiveDamage, 0);
    const didDie = remainingHealth === 0 && effectiveDamage > 0;

    this.currentHealth = didDie
      ? this.settings.maximumHealth
      : remainingHealth;

    return {
      effectiveDamage,
      didDie,
      snapshot: this.getSnapshot(),
    };
  }

  getSnapshot(): PlayerCombatSnapshot {
    return {
      currentHealth: this.currentHealth,
      maximumHealth: this.settings.maximumHealth,
      defensePercent: this.settings.defensePercent,
    };
  }
}
