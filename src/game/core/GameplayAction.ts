import type { GroundPoint, PlayerCombatSettings } from "../types";

export type GameplayAction =
  | {
      type: "start-ground-move";
      point: GroundPoint;
      timestampMs: number;
    }
  | { type: "steer-ground-move"; point: GroundPoint }
  | { type: "finish-ground-move"; timestampMs: number }
  | { type: "cancel-gameplay-input" }
  | { type: "activate-ability"; abilityId: "speed-boost" }
  | { type: "toggle-player-area" }
  | { type: "activate-target"; targetId: string }
  | {
      type: "update-player-combat-settings";
      settings: PlayerCombatSettings;
    }
  | { type: "update-player-name"; playerName: string };
