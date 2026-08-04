import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "./combat";
import {
  PLAYER_AUTO_ATTACK_DAMAGE,
  PLAYER_AUTO_ATTACK_INTERVAL_SECONDS,
  PLAYER_BASE_SPEED_METERS_PER_SECOND,
  TEST_DUMMY,
} from "./constants";
import { PLAYER_BASE_STATS } from "./player";

describe("player base stats", () => {
  it("defines the supplied editable base values and units", () => {
    expect(PLAYER_BASE_STATS).toMatchObject({
      attack: {
        autoAttackDamage: 20,
        physicalAbilityBonusPercent: 0,
        magicalAbilityBonusPercent: 0,
      },
      defensiveAttributes: {
        magicResistance: 0,
        armor: 0,
        maximumHealth: 1_200,
        healthRegeneration: { value: 12, unit: "perSecond" },
        maximumEnergy: 120,
        energyRegeneration: { value: 1.5, unit: "perSecond" },
      },
      movementAndControl: {
        movementSpeed: { value: 5.5, unit: "metersPerSecond" },
      },
      combatSpeeds: {
        autoAttackSpeed: { value: 1, unit: "attacksPerSecond" },
        damagePerSecond: 20,
      },
      energyAndHealing: {
        energyCostReductionPercent: 0,
        healingReceivedBonusPercent: 0,
        healingCastBonusPercent: 0,
      },
      players: {
        damageBonusPercent: 0,
        defenseBonusPercent: 0,
        crowdControlResistancePercent: 0,
        crowdControlDurationPercent: 0,
      },
      monsters: {
        damageBonusPercent: 0,
        defenseBonusPercent: 0,
        crowdControlResistancePercent: 0,
        crowdControlDurationPercent: 0,
      },
    });
  });

  it("derives active player values while leaving the dummy independent", () => {
    expect(PLAYER_AUTO_ATTACK_DAMAGE).toBe(
      PLAYER_BASE_STATS.attack.autoAttackDamage,
    );
    expect(PLAYER_BASE_SPEED_METERS_PER_SECOND).toBe(
      PLAYER_BASE_STATS.movementAndControl.movementSpeed.value,
    );
    expect(PLAYER_AUTO_ATTACK_INTERVAL_SECONDS).toBe(
      1 / PLAYER_BASE_STATS.combatSpeeds.autoAttackSpeed.value,
    );
    expect(DEFAULT_PLAYER_COMBAT_SETTINGS.maximumHealth).toBe(
      PLAYER_BASE_STATS.defensiveAttributes.maximumHealth,
    );
    expect(TEST_DUMMY.maximumHealth).toBe(10_000);
  });
});
