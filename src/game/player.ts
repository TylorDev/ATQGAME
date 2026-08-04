/** Reusable base-stat shape for players and future NPC enemies. */
export interface CharacterBaseStats {
  attack: {
    autoAttackDamage: number;
    physicalAbilityBonusPercent: number;
    magicalAbilityBonusPercent: number;
  };
  defensiveAttributes: {
    magicResistance: number;
    armor: number;
    maximumHealth: number;
    healthRegeneration: PerSecondStat;
    maximumEnergy: number;
    energyRegeneration: PerSecondStat;
  };
  energyAndHealing: {
    energyCostReductionPercent: number;
    healingReceivedBonusPercent: number;
    healingCastBonusPercent: number;
  };
  movementAndControl: {
    movementSpeed: MetersPerSecondStat;
    crowdControlResistancePercent: number;
  };
  combatSpeeds: {
    castTimePercent: number;
    autoAttackSpeed: AttacksPerSecondStat;
    damagePerSecond: number;
    cooldownTempoPercent: number;
  };
  players: TargetCombatModifiers;
  monsters: TargetCombatModifiers;
}

export interface PerSecondStat {
  value: number;
  unit: "perSecond";
}

export interface MetersPerSecondStat {
  value: number;
  unit: "metersPerSecond";
}

export interface AttacksPerSecondStat {
  value: number;
  unit: "attacksPerSecond";
}

export interface TargetCombatModifiers {
  damageBonusPercent: number;
  defenseBonusPercent: number;
  crowdControlResistancePercent: number;
  crowdControlDurationPercent: number;
}

/**
 * Edit this object to configure a base character. Future NPC enemies reuse the
 * same CharacterBaseStats shape; the test dummy intentionally does not.
 * Only the values explicitly marked as active are wired into gameplay today.
 */
export const PLAYER_BASE_STATS = {
  attack: {
    // Active: used by the current auto-attack controller.
    autoAttackDamage: 20,
    physicalAbilityBonusPercent: 0,
    magicalAbilityBonusPercent: 0,
  },
  defensiveAttributes: {
    magicResistance: 0,
    armor: 0,
    // Active: used as the initial maximum health before DEV overrides.
    maximumHealth: 1_200,
    healthRegeneration: {
      value: 12,
      unit: "perSecond",
    },
    maximumEnergy: 120,
    energyRegeneration: {
      value: 1.5,
      unit: "perSecond",
    },
  },
  energyAndHealing: {
    energyCostReductionPercent: 0,
    healingReceivedBonusPercent: 0,
    healingCastBonusPercent: 0,
  },
  movementAndControl: {
    // Active: used by the movement controller through the exported constant.
    movementSpeed: {
      value: 5.5,
      unit: "metersPerSecond",
    },
    crowdControlResistancePercent: 0,
  },
  combatSpeeds: {
    castTimePercent: 0,
    // Active: converted into the current auto-attack interval.
    autoAttackSpeed: {
      value: 1,
      unit: "attacksPerSecond",
    },
    damagePerSecond: 20,
    cooldownTempoPercent: 0,
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
} as const satisfies CharacterBaseStats;
