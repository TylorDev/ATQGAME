import {
  BURNING_TILE,
  OBSTACLES,
  PLAYER_AUTO_ATTACK_RANGE_METERS,
  TEST_DUMMY,
} from "../constants";
import {
  createDamageResult,
  PlayerVitalityController,
  type DamageResult,
} from "../combat";
import {
  BurningHazardController,
  BURNING_EFFECT,
  type BurningHazardSnapshot,
} from "../hazards";
import { MovementController } from "../MovementController";
import {
  SPEED_BOOST_EFFECT,
  SpeedBoostController,
  type SpeedBoostSnapshot,
} from "../playerStats";
import { ObstacleSpatialIndex } from "../SpatialHash2D";
import {
  AutoAttackController,
  TestDummyController,
  type TestDummyDamageResult,
} from "../testDummy";
import type {
  ActiveEffect,
  GroundHazardDefinition,
  GroundPoint,
  PlayerCombatSettings,
  TestDummyDefinition,
} from "../types";
import {
  createPerformanceLoadState,
  type PerformanceLoadState,
} from "./PerformanceLoadState";

export const DEATH_NOTICE_DURATION_MS = 3_000;

export interface WorldTargetState {
  readonly definition: TestDummyDefinition;
  readonly position: GroundPoint;
  readonly controller: TestDummyController;
  readonly autoAttack: AutoAttackController;
  readonly damageResult: TestDummyDamageResult;
  selected: boolean;
  pursuitActive: boolean;
}

export interface WorldPlayerState {
  readonly id: "local-player";
  name: string;
  readonly movement: MovementController;
  readonly vitality: PlayerVitalityController;
  readonly speedBoost: SpeedBoostController;
  readonly previousPosition: GroundPoint;
  readonly currentPosition: GroundPoint;
  readonly effects: ActiveEffect[];
  readonly speedBoostEffect: ActiveEffect;
  readonly burningEffect: ActiveEffect;
  readonly speedBoostSnapshot: SpeedBoostSnapshot;
  readonly damageResult: DamageResult;
  areaActive: boolean;
  isBurning: boolean;
  deathNoticeUntilMs: number;
  previousEffectsMask: number;
}

export interface WorldState {
  simulationTimeMs: number;
  readonly wallClockOffsetMs: number;
  readonly player: WorldPlayerState;
  readonly target: WorldTargetState;
  readonly burningHazard: BurningHazardController;
  readonly burningHazardDefinition: GroundHazardDefinition;
  readonly burningHazardSnapshot: BurningHazardSnapshot;
  readonly obstacleIndex: ObstacleSpatialIndex;
  readonly autoAttackRangeMeters: number;
  readonly performanceLoad: PerformanceLoadState | null;
  uiDirty: boolean;
}

export interface DefaultWorldOptions {
  initialTimeMs?: number;
  wallClockOriginMs?: number;
  playerName?: string;
  combatSettings?: PlayerCombatSettings;
  performanceLoadEnabled?: boolean;
}

function copyPoint(target: GroundPoint, source: GroundPoint): void {
  target.x = source.x;
  target.z = source.z;
}

export function createDefaultWorld(
  options: DefaultWorldOptions = {},
): WorldState {
  const simulationTimeMs = options.initialTimeMs ?? 0;
  const movement = new MovementController();
  const movementState = movement.getSnapshot();
  const previousPosition: GroundPoint = { x: 0, z: 0 };
  const currentPosition: GroundPoint = { x: 0, z: 0 };
  copyPoint(previousPosition, movementState.position);
  copyPoint(currentPosition, movementState.position);

  return {
    simulationTimeMs,
    wallClockOffsetMs:
      (options.wallClockOriginMs ?? Date.now()) - simulationTimeMs,
    player: {
      id: "local-player",
      name: options.playerName ?? "Jugador",
      movement,
      vitality: new PlayerVitalityController(options.combatSettings),
      speedBoost: new SpeedBoostController(),
      previousPosition,
      currentPosition,
      effects: [],
      speedBoostEffect: { ...SPEED_BOOST_EFFECT },
      burningEffect: { ...BURNING_EFFECT },
      speedBoostSnapshot: {
        isActive: false,
        durationRemainingMs: 0,
        cooldownRemainingMs: 0,
      },
      damageResult: createDamageResult(),
      areaActive: false,
      isBurning: false,
      deathNoticeUntilMs: 0,
      previousEffectsMask: 0,
    },
    target: {
      definition: TEST_DUMMY,
      position: {
        x: TEST_DUMMY.xMeters,
        z: TEST_DUMMY.zMeters,
      },
      controller: new TestDummyController(TEST_DUMMY),
      autoAttack: new AutoAttackController(),
      damageResult: {
        appliedDamage: 0,
        didDefeat: false,
        didApplyDamage: false,
      },
      selected: false,
      pursuitActive: false,
    },
    burningHazard: new BurningHazardController(),
    burningHazardDefinition: BURNING_TILE,
    burningHazardSnapshot: { isActive: false, damageTicks: 0 },
    obstacleIndex: new ObstacleSpatialIndex(OBSTACLES),
    autoAttackRangeMeters: PLAYER_AUTO_ATTACK_RANGE_METERS,
    performanceLoad: options.performanceLoadEnabled
      ? createPerformanceLoadState()
      : null,
    uiDirty: true,
  };
}
