/**
 * Ground position expressed in meters. One world unit equals one meter.
 */
export interface GroundPoint {
  x: number;
  z: number;
}

export interface ObstacleDefinition {
  readonly id: string;
  readonly xMeters: number;
  readonly zMeters: number;
  readonly widthMeters: number;
  readonly depthMeters: number;
  readonly heightMeters: number;
}

export interface GroundHazardDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly xMeters: number;
  readonly zMeters: number;
  readonly widthMeters: number;
  readonly depthMeters: number;
  readonly damagePerTick: number;
  readonly tickIntervalSeconds: number;
}

export interface TestDummyDefinition {
  readonly id: string;
  readonly displayName: string;
  readonly xMeters: number;
  readonly zMeters: number;
  readonly footprintRadiusMeters: number;
  readonly maximumHealth: number;
}

export interface TestDummySnapshot {
  id: string;
  currentHealth: number;
  maximumHealth: number;
  lastDamageReceived: number;
  totalDamageReceived: number;
  damagePerSecond: number;
  isDefeated: boolean;
  respawnRemainingSeconds: number;
}

export type EffectKind = "buff" | "debuff";

export interface ActiveEffect {
  id: string;
  kind: EffectKind;
  name: string;
  description: string;
  /** A 0–1 value for a circular in-world timer. Persistent effects use 1. */
  timerProgress: number;
}

export interface PlayerCombatSettings {
  maximumHealth: number;
  defensePercent: number;
}

export interface PlayerCombatSnapshot extends PlayerCombatSettings {
  currentHealth: number;
}

export interface PlayerHudState extends PlayerCombatSnapshot {
  activeEffects: readonly ActiveEffect[];
  isDeathNoticeVisible: boolean;
}

export type MovementMode =
  | "idle"
  | "clickToPoint"
  | "holdDirection"
  | "followTarget"
  | "blocked";

export interface MovementSnapshot {
  mode: MovementMode;
  position: GroundPoint;
  facing: GroundPoint;
  target: GroundPoint | null;
  followTarget: GroundPoint | null;
  isClickTargetConfirmed: boolean;
  speedMetersPerSecond: number;
}
