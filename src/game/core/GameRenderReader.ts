import type {
  ActiveEffect,
  GroundPoint,
  MovementSnapshot,
  PlayerCombatSnapshot,
  TestDummySnapshot,
} from "../types";
import {
  PERFORMANCE_LOAD_VISIBLE_ENTITIES,
} from "./PerformanceLoadState";
import type { WorldState } from "./WorldState";

export interface PlayerRenderBuffer {
  readonly previousPosition: GroundPoint;
  readonly currentPosition: GroundPoint;
  readonly interpolatedPosition: GroundPoint;
  readonly combat: PlayerCombatSnapshot;
  readonly effects: ActiveEffect[];
  interpolationAlpha: number;
  areaActive: boolean;
  simulationTimeMs: number;
}

export interface MovementRenderBuffer {
  readonly movement: MovementSnapshot;
  readonly playerPosition: GroundPoint;
  readonly targetPosition: GroundPoint;
  targetSelected: boolean;
  targetPursuitActive: boolean;
}

export interface TargetRenderBuffer {
  readonly snapshot: TestDummySnapshot;
  readonly position: GroundPoint;
  selected: boolean;
}

export interface PerformanceLoadRenderBuffer {
  readonly positions: Float32Array;
  visibleCount: number;
  activeCount: number;
}

function createPoint(): GroundPoint {
  return { x: 0, z: 0 };
}

function copyPoint(output: GroundPoint, source: GroundPoint): void {
  output.x = source.x;
  output.z = source.z;
}

function copyEffects(output: ActiveEffect[], source: readonly ActiveEffect[]): void {
  for (let index = 0; index < source.length; index += 1) {
    const sourceEffect = source[index];
    const effect = output[index] ?? {
      id: "",
      kind: "buff",
      name: "",
      description: "",
      timerProgress: 0,
    };
    effect.id = sourceEffect.id;
    effect.kind = sourceEffect.kind;
    effect.name = sourceEffect.name;
    effect.description = sourceEffect.description;
    effect.timerProgress = sourceEffect.timerProgress;
    output[index] = effect;
  }

  output.length = source.length;
}

export function createPlayerRenderBuffer(): PlayerRenderBuffer {
  return {
    previousPosition: createPoint(),
    currentPosition: createPoint(),
    interpolatedPosition: createPoint(),
    combat: { currentHealth: 0, maximumHealth: 0, defensePercent: 0 },
    effects: [],
    interpolationAlpha: 0,
    areaActive: false,
    simulationTimeMs: 0,
  };
}

export function createMovementRenderBuffer(): MovementRenderBuffer {
  return {
    movement: {
      mode: "idle",
      position: createPoint(),
      facing: { x: 0, z: 1 },
      target: null,
      followTarget: null,
      isClickTargetConfirmed: false,
      speedMetersPerSecond: 0,
    },
    playerPosition: createPoint(),
    targetPosition: createPoint(),
    targetSelected: false,
    targetPursuitActive: false,
  };
}

export function createTargetRenderBuffer(): TargetRenderBuffer {
  return {
    snapshot: {
      id: "",
      currentHealth: 0,
      maximumHealth: 0,
      lastDamageReceived: 0,
      totalDamageReceived: 0,
      damagePerSecond: 0,
      isDefeated: false,
      respawnRemainingSeconds: 0,
    },
    position: createPoint(),
    selected: false,
  };
}

export function createPerformanceLoadRenderBuffer(): PerformanceLoadRenderBuffer {
  return {
    positions: new Float32Array(PERFORMANCE_LOAD_VISIBLE_ENTITIES * 2),
    visibleCount: 0,
    activeCount: 0,
  };
}

export class GameRenderReader {
  constructor(
    private readonly world: WorldState,
    private readonly readInterpolationAlpha: () => number,
  ) {}

  writePlayer(output: PlayerRenderBuffer): void {
    const interpolationAlpha = this.readInterpolationAlpha();
    copyPoint(output.previousPosition, this.world.player.previousPosition);
    copyPoint(output.currentPosition, this.world.player.currentPosition);
    output.interpolatedPosition.x =
      this.world.player.previousPosition.x +
      (this.world.player.currentPosition.x - this.world.player.previousPosition.x) *
        interpolationAlpha;
    output.interpolatedPosition.z =
      this.world.player.previousPosition.z +
      (this.world.player.currentPosition.z - this.world.player.previousPosition.z) *
        interpolationAlpha;
    this.world.player.vitality.writeSnapshot(output.combat);
    copyEffects(output.effects, this.world.player.effects);
    output.interpolationAlpha = interpolationAlpha;
    output.areaActive = this.world.player.areaActive;
    output.simulationTimeMs = this.world.simulationTimeMs;
  }

  writeMovement(output: MovementRenderBuffer): void {
    const interpolationAlpha = this.readInterpolationAlpha();
    this.world.player.movement.writeSnapshot(output.movement);
    output.playerPosition.x =
      this.world.player.previousPosition.x +
      (this.world.player.currentPosition.x - this.world.player.previousPosition.x) *
        interpolationAlpha;
    output.playerPosition.z =
      this.world.player.previousPosition.z +
      (this.world.player.currentPosition.z - this.world.player.previousPosition.z) *
        interpolationAlpha;
    copyPoint(output.targetPosition, this.world.target.position);
    output.targetSelected = this.world.target.selected;
    output.targetPursuitActive = this.world.target.pursuitActive;
  }

  writeTarget(output: TargetRenderBuffer): void {
    this.world.target.controller.writeSnapshot(output.snapshot);
    copyPoint(output.position, this.world.target.position);
    output.selected = this.world.target.selected;
  }

  writePerformanceLoad(output: PerformanceLoadRenderBuffer): boolean {
    const load = this.world.performanceLoad;

    if (!load) {
      output.visibleCount = 0;
      output.activeCount = 0;
      return false;
    }

    const valueCount = load.visibleCount * 2;
    const interpolationAlpha = this.readInterpolationAlpha();

    for (let index = 0; index < valueCount; index += 1) {
      output.positions[index] =
        load.previousPositions[index] +
        (load.currentPositions[index] - load.previousPositions[index]) *
          interpolationAlpha;
    }

    output.visibleCount = load.visibleCount;
    output.activeCount = load.activeCount;
    return true;
  }
}
