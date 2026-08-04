import {
  PLAYER_AUTO_ATTACK_DAMAGE,
  PLAYER_AUTO_ATTACK_INTERVAL_SECONDS,
  PLAYER_BASE_SPEED_METERS_PER_SECOND,
} from "./constants";
import { PLAYER_BASE_STATS } from "./player";

export type PlayerStatStatus = "active" | "placeholder";

export interface PlayerStatPresentation {
  id: string;
  label: string;
  value: number;
  unit: string;
  status: PlayerStatStatus;
}

export interface PlayerStatCategory {
  id: string;
  label: string;
  stats: readonly PlayerStatPresentation[];
}

export function getActivePlayerStats(
  maximumHealth: number,
): readonly PlayerStatPresentation[] {
  return [
    {
      id: "auto-attack-damage",
      label: "Daño de autoataque",
      value: PLAYER_AUTO_ATTACK_DAMAGE,
      unit: "daño",
      status: "active",
    },
    {
      id: "maximum-health",
      label: "Vida máxima",
      value: maximumHealth,
      unit: "HP",
      status: "active",
    },
    {
      id: "movement-speed",
      label: "Velocidad de movimiento",
      value: PLAYER_BASE_SPEED_METERS_PER_SECOND,
      unit: "m/s",
      status: "active",
    },
    {
      id: "attack-speed",
      label: "Velocidad de autoataque",
      value: 1 / PLAYER_AUTO_ATTACK_INTERVAL_SECONDS,
      unit: "APS",
      status: "active",
    },
  ];
}

export const PLAYER_PLACEHOLDER_STAT_CATEGORIES: readonly PlayerStatCategory[] = [
  {
    id: "attack",
    label: "Ataque y habilidades",
    stats: [
      {
        id: "physical-ability-bonus",
        label: "Bono de habilidad física",
        value: PLAYER_BASE_STATS.attack.physicalAbilityBonusPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "magical-ability-bonus",
        label: "Bono de habilidad mágica",
        value: PLAYER_BASE_STATS.attack.magicalAbilityBonusPercent,
        unit: "%",
        status: "placeholder",
      },
    ],
  },
  {
    id: "defense",
    label: "Defensa y recursos",
    stats: [
      {
        id: "magic-resistance",
        label: "Resistencia mágica",
        value: PLAYER_BASE_STATS.defensiveAttributes.magicResistance,
        unit: "pts",
        status: "placeholder",
      },
      {
        id: "armor",
        label: "Armadura",
        value: PLAYER_BASE_STATS.defensiveAttributes.armor,
        unit: "pts",
        status: "placeholder",
      },
      {
        id: "health-regeneration",
        label: "Regeneración de salud",
        value: PLAYER_BASE_STATS.defensiveAttributes.healthRegeneration.value,
        unit: "HP/s",
        status: "placeholder",
      },
      {
        id: "maximum-energy",
        label: "Energía máxima",
        value: PLAYER_BASE_STATS.defensiveAttributes.maximumEnergy,
        unit: "EN",
        status: "placeholder",
      },
      {
        id: "energy-regeneration",
        label: "Regeneración de energía",
        value: PLAYER_BASE_STATS.defensiveAttributes.energyRegeneration.value,
        unit: "EN/s",
        status: "placeholder",
      },
    ],
  },
  {
    id: "healing",
    label: "Energía y curación",
    stats: [
      {
        id: "energy-cost-reduction",
        label: "Reducción de coste de energía",
        value: PLAYER_BASE_STATS.energyAndHealing.energyCostReductionPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "healing-received",
        label: "Bono al recibir curación",
        value: PLAYER_BASE_STATS.energyAndHealing.healingReceivedBonusPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "healing-cast",
        label: "Bono de lanzamiento de cura",
        value: PLAYER_BASE_STATS.energyAndHealing.healingCastBonusPercent,
        unit: "%",
        status: "placeholder",
      },
    ],
  },
  {
    id: "combat-speed",
    label: "Velocidades de combate",
    stats: [
      {
        id: "cast-time",
        label: "Tiempo de lanzamiento",
        value: PLAYER_BASE_STATS.combatSpeeds.castTimePercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "damage-per-second",
        label: "Daño por segundo",
        value: PLAYER_BASE_STATS.combatSpeeds.damagePerSecond,
        unit: "DPS",
        status: "placeholder",
      },
      {
        id: "cooldown-tempo",
        label: "Ritmo de tiempo de espera",
        value: PLAYER_BASE_STATS.combatSpeeds.cooldownTempoPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "crowd-control-resistance",
        label: "Resistencia a control de masas",
        value: PLAYER_BASE_STATS.movementAndControl.crowdControlResistancePercent,
        unit: "%",
        status: "placeholder",
      },
    ],
  },
  {
    id: "target-modifiers",
    label: "Modificadores de objetivo",
    stats: [
      {
        id: "player-damage",
        label: "Daño contra jugadores",
        value: PLAYER_BASE_STATS.players.damageBonusPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "player-defense",
        label: "Defensa contra jugadores",
        value: PLAYER_BASE_STATS.players.defenseBonusPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "player-control-resistance",
        label: "Resistencia CM contra jugadores",
        value: PLAYER_BASE_STATS.players.crowdControlResistancePercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "player-control-duration",
        label: "Duración CM contra jugadores",
        value: PLAYER_BASE_STATS.players.crowdControlDurationPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "monster-damage",
        label: "Daño contra monstruos",
        value: PLAYER_BASE_STATS.monsters.damageBonusPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "monster-defense",
        label: "Defensa contra monstruos",
        value: PLAYER_BASE_STATS.monsters.defenseBonusPercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "monster-control-resistance",
        label: "Resistencia CM contra monstruos",
        value: PLAYER_BASE_STATS.monsters.crowdControlResistancePercent,
        unit: "%",
        status: "placeholder",
      },
      {
        id: "monster-control-duration",
        label: "Duración CM contra monstruos",
        value: PLAYER_BASE_STATS.monsters.crowdControlDurationPercent,
        unit: "%",
        status: "placeholder",
      },
    ],
  },
];
