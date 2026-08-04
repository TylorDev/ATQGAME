import type { PlayerCombatSettings, PlayerCombatSnapshot } from "./types";
import { PLAYER_BASE_STATS } from "./player";

export const PLAYER_MAXIMUM_HEALTH_MIN = 100;
export const PLAYER_MAXIMUM_HEALTH_MAX = 5_000;
export const PLAYER_MAXIMUM_HEALTH_STEP = 100;
export const PLAYER_DEFENSE_PERCENT_MIN = 0;
export const PLAYER_DEFENSE_PERCENT_MAX = 100;
export const PLAYER_DEFENSE_PERCENT_STEP = 1;

export const DEFAULT_PLAYER_COMBAT_SETTINGS: Readonly<PlayerCombatSettings> = {
  maximumHealth: PLAYER_BASE_STATS.defensiveAttributes.maximumHealth,
  defensePercent: 0,
};

export interface DamageResult {
  effectiveDamage: number;
  appliedDamage: number;
  didDie: boolean;
  snapshot: PlayerCombatSnapshot;
}

export function createDamageResult(): DamageResult {
  return {
    effectiveDamage: 0,
    appliedDamage: 0,
    didDie: false,
    snapshot: { currentHealth: 0, maximumHealth: 0, defensePercent: 0 },
  };
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
  private readonly state: PlayerCombatSnapshot;

  constructor(settings: PlayerCombatSettings = DEFAULT_PLAYER_COMBAT_SETTINGS) {
    const normalized = normalizePlayerCombatSettings(settings);
    this.state = {
      ...normalized,
      currentHealth: normalized.maximumHealth,
    };
  }

  updateSettings(settings: PlayerCombatSettings): PlayerCombatSnapshot {
    const normalized = normalizePlayerCombatSettings(settings);
    this.state.maximumHealth = normalized.maximumHealth;
    this.state.defensePercent = normalized.defensePercent;
    this.state.currentHealth = Math.min(
      this.state.currentHealth,
      this.state.maximumHealth,
    );

    return this.getSnapshot();
  }

  applyDamage(
    baseDamage: number,
    output: DamageResult = createDamageResult(),
  ): DamageResult {
    const safeBaseDamage = Number.isFinite(baseDamage)
      ? Math.max(0, baseDamage)
      : 0;
    const effectiveDamage =
      safeBaseDamage * (1 - this.state.defensePercent / 100);
    const remainingHealth = Math.max(this.state.currentHealth - effectiveDamage, 0);
    const appliedDamage = this.state.currentHealth - remainingHealth;
    const didDie = remainingHealth === 0 && appliedDamage > 0;

    this.state.currentHealth = didDie
      ? this.state.maximumHealth
      : remainingHealth;

    output.effectiveDamage = effectiveDamage;
    output.appliedDamage = appliedDamage;
    output.didDie = didDie;
    this.writeSnapshot(output.snapshot);
    return output;
  }

  getSnapshot(): PlayerCombatSnapshot {
    return this.writeSnapshot({
      currentHealth: 0,
      maximumHealth: 0,
      defensePercent: 0,
    });
  }

  writeSnapshot(output: PlayerCombatSnapshot): PlayerCombatSnapshot {
    output.currentHealth = this.state.currentHealth;
    output.maximumHealth = this.state.maximumHealth;
    output.defensePercent = this.state.defensePercent;
    return output;
  }
}
