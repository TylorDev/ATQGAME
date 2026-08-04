import {
  BURNING_TILE,
  OBSTACLES,
  PLAYER_AUTO_ATTACK_RANGE_METERS,
  PLAYER_RADIUS_METERS,
  TARGET_DESELECT_DISTANCE_METERS,
  TEST_DUMMY,
} from "./constants";
import { PlayerVitalityController } from "./combat";
import {
  BurningHazardController,
  circleIntersectsGroundHazard,
} from "./hazards";
import { MovementController, type MovementStateView } from "./MovementController";
import {
  SPEED_BOOST_EFFECT,
  SPEED_BOOST_DURATION_MS,
  SpeedBoostController,
  getCurrentPlayerSpeedMetersPerSecond,
  type PlayerDebugStats,
} from "./playerStats";
import { getEffectTimerProgress } from "./overheadStatus";
import {
  PLAYER_AREA_RADIUS_METERS,
  playerAreaTouchesTarget,
} from "./playerArea";
import { ObstacleSpatialIndex } from "./SpatialHash2D";
import {
  AutoAttackController,
  TestDummyController,
  isWithinAutoAttackRange,
  type TestDummyStateView,
} from "./testDummy";
import type {
  PublishAreaPresenceLogInput,
  PublishDamageLogInput,
} from "./gameLog";
import type {
  ActiveEffect,
  GroundPoint,
  PlayerCombatSettings,
  PlayerCombatSnapshot,
  PlayerHudState,
  TestDummySnapshot,
} from "./types";

export const SIMULATION_TICK_SECONDS = 1 / 60;
export const MAX_SIMULATION_STEPS_PER_FRAME = 3;
export const MAX_SIMULATION_FRAME_DELTA_SECONDS = 0.05;
export const UI_PUBLISH_INTERVAL_MS = 100;
export const PERFORMANCE_LOAD_ACTIVE_ENTITIES = 50;
export const PERFORMANCE_LOAD_VISIBLE_ENTITIES = 100;
const DEATH_NOTICE_DURATION_MS = 3_000;

export const enum GameUiSnapshotMask {
  Player = 1,
  Target = 2,
  Debug = 4,
  All = Player | Target | Debug,
}

export type GameCommand =
  | { type: "begin-right-press"; point: GroundPoint; timestampMs: number }
  | { type: "update-pointer-ground"; point: GroundPoint }
  | { type: "end-right-press"; timestampMs: number }
  | { type: "cancel-input" }
  | { type: "activate-speed-boost" }
  | { type: "toggle-player-area" }
  | { type: "activate-target" }
  | { type: "set-target-pursuit"; active: boolean }
  | { type: "deselect-target" }
  | { type: "update-combat-settings"; settings: PlayerCombatSettings }
  | { type: "update-player-name"; playerName: string };

export type GameEvent =
  | { type: "damage"; payload: PublishDamageLogInput }
  | { type: "area-presence"; payload: PublishAreaPresenceLogInput }
  | { type: "vitality-change"; receiverId: string; healthDelta: number }
  | { type: "target-selected" }
  | { type: "target-deselected" }
  | { type: "critical-ui-change" };

export interface PerformanceLoadState {
  readonly previousPositions: Float32Array;
  readonly currentPositions: Float32Array;
  readonly velocities: Float32Array;
  readonly visibleCount: number;
  readonly activeCount: number;
}

export interface GameRenderState {
  readonly movement: MovementStateView;
  readonly previousPlayerPosition: GroundPoint;
  readonly currentPlayerPosition: GroundPoint;
  readonly playerCombat: PlayerCombatSnapshot;
  readonly playerEffects: readonly ActiveEffect[];
  readonly testDummy: TestDummyStateView;
  readonly performanceLoad: PerformanceLoadState | null;
  playerAreaActive: boolean;
  targetSelected: boolean;
  targetPursuitActive: boolean;
  simulationTimeMs: number;
}

export interface GameUiSnapshot {
  readonly mask: GameUiSnapshotMask;
  readonly playerHud: PlayerHudState;
  readonly testDummy: TestDummySnapshot;
  readonly debug: PlayerDebugStats;
  readonly targetSelected: boolean;
}

interface GameSimulationOptions {
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

function createPerformanceLoadState(): PerformanceLoadState {
  const previousPositions = new Float32Array(
    PERFORMANCE_LOAD_VISIBLE_ENTITIES * 2,
  );
  const currentPositions = new Float32Array(
    PERFORMANCE_LOAD_VISIBLE_ENTITIES * 2,
  );
  const velocities = new Float32Array(PERFORMANCE_LOAD_ACTIVE_ENTITIES * 2);

  for (let index = 0; index < PERFORMANCE_LOAD_VISIBLE_ENTITIES; index += 1) {
    const column = index % 10;
    const row = Math.floor(index / 10);
    const positionIndex = index * 2;
    currentPositions[positionIndex] = -36 + column * 8;
    currentPositions[positionIndex + 1] = -36 + row * 8;
    previousPositions[positionIndex] = currentPositions[positionIndex];
    previousPositions[positionIndex + 1] = currentPositions[positionIndex + 1];

    if (index < PERFORMANCE_LOAD_ACTIVE_ENTITIES) {
      const angle = index * 2.399963229728653;
      velocities[positionIndex] = Math.cos(angle) * 1.4;
      velocities[positionIndex + 1] = Math.sin(angle) * 1.4;
    }
  }

  return {
    previousPositions,
    currentPositions,
    velocities,
    visibleCount: PERFORMANCE_LOAD_VISIBLE_ENTITIES,
    activeCount: PERFORMANCE_LOAD_ACTIVE_ENTITIES,
  };
}

export class GameSimulation {
  private readonly movement = new MovementController();
  private readonly obstacleIndex = new ObstacleSpatialIndex(OBSTACLES);
  private readonly speedBoost = new SpeedBoostController();
  private readonly vitality: PlayerVitalityController;
  private readonly burningHazard = new BurningHazardController();
  private readonly testDummy = new TestDummyController(TEST_DUMMY);
  private readonly autoAttack = new AutoAttackController();
  private readonly commands: GameCommand[] = [];
  private readonly pendingPointerGround: GroundPoint = { x: 0, z: 0 };
  private hasPendingPointerGround = false;
  private readonly events: GameEvent[] = [];
  private readonly previousPlayerPosition: GroundPoint = { x: 0, z: 0 };
  private readonly currentPlayerPosition: GroundPoint = { x: 0, z: 0 };
  private readonly speedBoostEffect: ActiveEffect = { ...SPEED_BOOST_EFFECT };
  private readonly burningEffect: ActiveEffect = {
    id: "burning",
    kind: "debuff",
    name: "Ardiendo",
    description:
      "El suelo abrasador inflige 100 de daño base cada 2 s. La defensa reduce el daño.",
    timerProgress: 1,
  };
  private readonly targetPosition: GroundPoint = {
    x: TEST_DUMMY.xMeters,
    z: TEST_DUMMY.zMeters,
  };
  private readonly playerEffects: ActiveEffect[] = [];
  private readonly performanceLoad: PerformanceLoadState | null;
  private readonly renderState: GameRenderState;
  private accumulatorSeconds = 0;
  private simulationTimeMs: number;
  private readonly wallClockOffsetMs: number;
  private targetSelected = false;
  private targetPursuitActive = false;
  private playerAreaActive = false;
  private playerName: string;
  private deathNoticeUntilMs = 0;
  private previousEffectsMask = 0;
  private criticalUiDirty = true;

  constructor(options: GameSimulationOptions = {}) {
    this.simulationTimeMs = options.initialTimeMs ?? 0;
    this.wallClockOffsetMs =
      (options.wallClockOriginMs ?? Date.now()) - this.simulationTimeMs;
    this.playerName = options.playerName ?? "Jugador";
    this.vitality = new PlayerVitalityController(options.combatSettings);
    this.performanceLoad = options.performanceLoadEnabled
      ? createPerformanceLoadState()
      : null;
    const movementState = this.movement.getState();
    copyPoint(this.previousPlayerPosition, movementState.position);
    copyPoint(this.currentPlayerPosition, movementState.position);
    this.renderState = {
      movement: movementState,
      previousPlayerPosition: this.previousPlayerPosition,
      currentPlayerPosition: this.currentPlayerPosition,
      playerCombat: this.vitality.getState(),
      playerEffects: this.playerEffects,
      testDummy: this.testDummy.getState(this.simulationTimeMs),
      performanceLoad: this.performanceLoad,
      playerAreaActive: false,
      targetSelected: false,
      targetPursuitActive: false,
      simulationTimeMs: this.simulationTimeMs,
    };
    this.syncEffects(false);
  }

  enqueueCommand(command: GameCommand): void {
    if (command.type === "update-pointer-ground") {
      copyPoint(this.pendingPointerGround, command.point);
      this.hasPendingPointerGround = true;
      return;
    }

    this.commands.push(command);
  }

  advanceFrame(deltaSeconds: number): number {
    const safeDeltaSeconds = Math.min(
      Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0),
      MAX_SIMULATION_FRAME_DELTA_SECONDS,
    );
    this.accumulatorSeconds += safeDeltaSeconds;
    let steps = 0;

    while (
      this.accumulatorSeconds + Number.EPSILON >= SIMULATION_TICK_SECONDS &&
      steps < MAX_SIMULATION_STEPS_PER_FRAME
    ) {
      this.stepFixed();
      this.accumulatorSeconds -= SIMULATION_TICK_SECONDS;
      steps += 1;
    }

    if (steps === MAX_SIMULATION_STEPS_PER_FRAME) {
      this.accumulatorSeconds = Math.min(
        Math.max(this.accumulatorSeconds, 0),
        SIMULATION_TICK_SECONDS - Number.EPSILON,
      );
    }

    return Math.min(
      Math.max(this.accumulatorSeconds / SIMULATION_TICK_SECONDS, 0),
      1,
    );
  }

  resetFrameAccumulator(): void {
    this.accumulatorSeconds = 0;
  }

  getRenderState(): GameRenderState {
    return this.renderState;
  }

  createUiSnapshot(
    mask: GameUiSnapshotMask = GameUiSnapshotMask.All,
  ): GameUiSnapshot {
    const combat = this.vitality.getState();
    const speed = this.speedBoost.update(this.simulationTimeMs);

    return {
      mask,
      playerHud: {
        currentHealth: combat.currentHealth,
        maximumHealth: combat.maximumHealth,
        defensePercent: combat.defensePercent,
        activeEffects: this.playerEffects.map((effect) => ({ ...effect })),
        isDeathNoticeVisible:
          this.simulationTimeMs < this.deathNoticeUntilMs,
      },
      testDummy: this.testDummy.writeSnapshot(),
      debug: {
        speedMetersPerSecond: this.movement.getState().speedMetersPerSecond,
        isActive: speed.isActive,
        durationRemainingMs: speed.durationRemainingMs,
        cooldownRemainingMs: speed.cooldownRemainingMs,
        currentHealth: combat.currentHealth,
        maximumHealth: combat.maximumHealth,
        defensePercent: combat.defensePercent,
      },
      targetSelected: this.targetSelected,
    };
  }

  drainEvents(visitor: (event: GameEvent) => void): void {
    for (let index = 0; index < this.events.length; index += 1) {
      visitor(this.events[index]);
    }

    this.events.length = 0;
  }

  consumeCriticalUiDirty(): boolean {
    const wasDirty = this.criticalUiDirty;
    this.criticalUiDirty = false;
    return wasDirty;
  }

  private stepFixed(): void {
    this.simulationTimeMs += SIMULATION_TICK_SECONDS * 1_000;
    this.processCommands();
    const movementBefore = this.movement.getState();
    copyPoint(this.previousPlayerPosition, movementBefore.position);
    const boost = this.speedBoost.update(this.simulationTimeMs);
    this.movement.step(
      SIMULATION_TICK_SECONDS,
      this.simulationTimeMs,
      this.obstacleIndex,
      getCurrentPlayerSpeedMetersPerSecond(boost),
    );
    const movementAfter = this.movement.getState();
    copyPoint(this.currentPlayerPosition, movementAfter.position);
    this.publishPlayerAreaPresence(movementAfter.position);

    if (this.targetSelected) {
      const targetDistance = Math.hypot(
        movementAfter.position.x - TEST_DUMMY.xMeters,
        movementAfter.position.z - TEST_DUMMY.zMeters,
      );

      if (targetDistance >= TARGET_DESELECT_DISTANCE_METERS) {
        this.deselectTarget();
      }
    }

    const didRespawn = this.testDummy.step(
      SIMULATION_TICK_SECONDS,
      this.simulationTimeMs,
    );

    if (didRespawn) {
      this.events.push({
        type: "vitality-change",
        receiverId: TEST_DUMMY.id,
        healthDelta: TEST_DUMMY.maximumHealth,
      });
      this.markCriticalUiChange();
    }

    const dummyState = this.testDummy.getState();
    const canAttack =
      this.targetSelected &&
      !dummyState.isDefeated &&
      isWithinAutoAttackRange(movementAfter.position, this.targetPosition);
    const attacks = this.autoAttack.step(SIMULATION_TICK_SECONDS, canAttack);

    for (let attack = 0; attack < attacks; attack += 1) {
      const result = this.testDummy.applyDamage(
        this.autoAttack.getDamagePerAttack(),
        this.simulationTimeMs,
      );

      this.events.push({
        type: "vitality-change",
        receiverId: TEST_DUMMY.id,
        healthDelta:
          result.appliedDamage > 0 ? -result.appliedDamage : 0,
      });

      if (result.appliedDamage > 0) {
        this.events.push({
          type: "damage",
          payload: {
            occurredAtMs: this.wallClockOffsetMs + this.simulationTimeMs,
            appliedDamage: result.appliedDamage,
            receiver: {
              id: TEST_DUMMY.id,
              kind: "test-dummy",
              displayName: TEST_DUMMY.displayName,
            },
            source: {
              id: "local-player",
              kind: "player",
              displayName: this.playerName,
            },
          },
        });
      }

      if (result.didDefeat) {
        this.markCriticalUiChange();
      }
    }

    const isInsideBurningTile = circleIntersectsGroundHazard(
      movementAfter.position,
      PLAYER_RADIUS_METERS,
      BURNING_TILE,
    );
    const hazard = this.burningHazard.step(
      SIMULATION_TICK_SECONDS,
      isInsideBurningTile,
      BURNING_TILE.tickIntervalSeconds,
    );

    for (let tick = 0; tick < hazard.damageTicks; tick += 1) {
      const result = this.vitality.applyDamage(BURNING_TILE.damagePerTick);

      this.events.push({
        type: "vitality-change",
        receiverId: "local-player",
        healthDelta:
          result.appliedDamage > 0 ? -result.appliedDamage : 0,
      });

      if (result.appliedDamage > 0) {
        this.events.push({
          type: "damage",
          payload: {
            occurredAtMs: this.wallClockOffsetMs + this.simulationTimeMs,
            appliedDamage: result.appliedDamage,
            receiver: {
              id: "local-player",
              kind: "player",
              displayName: this.playerName,
            },
            source: {
              id: BURNING_TILE.id,
              kind: "entity",
              displayName: BURNING_TILE.displayName,
            },
          },
        });
      }

      if (result.didDie) {
        this.events.push({
          type: "vitality-change",
          receiverId: "local-player",
          healthDelta: result.snapshot.currentHealth,
        });
        this.deathNoticeUntilMs =
          this.simulationTimeMs + DEATH_NOTICE_DURATION_MS;
        this.markCriticalUiChange();
      }
    }

    this.syncEffects(hazard.isActive);
    this.updatePerformanceLoad();
    this.renderState.playerAreaActive = this.playerAreaActive;
    this.renderState.targetSelected = this.targetSelected;
    this.renderState.targetPursuitActive = this.targetPursuitActive;
    this.renderState.simulationTimeMs = this.simulationTimeMs;
  }

  private processCommands(): void {
    for (let index = 0; index < this.commands.length; index += 1) {
      const command = this.commands[index];

      switch (command.type) {
        case "begin-right-press":
          this.movement.pauseFollowTarget();
          this.targetPursuitActive = false;
          this.movement.beginRightPress(command.point, command.timestampMs);
          break;
        case "update-pointer-ground":
          break;
        case "end-right-press":
          this.movement.endRightPress(command.timestampMs);
          break;
        case "cancel-input":
          this.movement.cancelInput();
          break;
        case "activate-speed-boost":
          this.speedBoost.activate(this.simulationTimeMs);
          break;
        case "toggle-player-area":
          this.playerAreaActive = !this.playerAreaActive;

          if (!this.playerAreaActive) {
            this.events.push({
              type: "area-presence",
              payload: {
                occurredAtMs: this.wallClockOffsetMs + this.simulationTimeMs,
                target: {
                  id: TEST_DUMMY.id,
                  kind: "test-dummy",
                  displayName: TEST_DUMMY.displayName,
                },
                status: "deactivated",
                areaRadiusMeters: PLAYER_AREA_RADIUS_METERS,
              },
            });
          }
          break;
        case "activate-target":
          this.activateTarget();
          break;
        case "set-target-pursuit":
          this.setTargetPursuit(command.active);
          break;
        case "deselect-target":
          this.deselectTarget();
          break;
        case "update-combat-settings":
          this.vitality.updateSettings(command.settings);
          this.markCriticalUiChange();
          break;
        case "update-player-name":
          this.playerName = command.playerName;
          break;
      }
    }

    this.commands.length = 0;

    if (this.hasPendingPointerGround) {
      this.movement.updatePointerGround(this.pendingPointerGround);
      this.hasPendingPointerGround = false;
    }
  }

  private activateTarget(): void {
    const wasSelected = this.targetSelected;
    this.targetSelected = true;
    this.targetPursuitActive = true;
    this.movement.resumeFollowTarget(
      this.targetPosition,
      PLAYER_AUTO_ATTACK_RANGE_METERS,
    );

    if (!wasSelected) {
      this.events.push({ type: "target-selected" });
    }

    this.markCriticalUiChange();
  }

  private publishPlayerAreaPresence(playerPosition: GroundPoint): void {
    if (!this.playerAreaActive) {
      return;
    }

    const isInside = playerAreaTouchesTarget(
      playerPosition,
      this.targetPosition,
      TEST_DUMMY.footprintRadiusMeters,
    );

    this.events.push({
      type: "area-presence",
      payload: {
        occurredAtMs: this.wallClockOffsetMs + this.simulationTimeMs,
        target: {
          id: TEST_DUMMY.id,
          kind: "test-dummy",
          displayName: TEST_DUMMY.displayName,
        },
        status: isInside ? "inside" : "outside",
        areaRadiusMeters: PLAYER_AREA_RADIUS_METERS,
      },
    });
  }

  private setTargetPursuit(active: boolean): void {
    this.targetPursuitActive = active && this.targetSelected;

    if (this.targetPursuitActive) {
      this.movement.resumeFollowTarget(
        this.targetPosition,
        PLAYER_AUTO_ATTACK_RANGE_METERS,
      );
    } else {
      this.movement.pauseFollowTarget();
    }
  }

  private deselectTarget(): void {
    if (!this.targetSelected) {
      return;
    }

    this.targetSelected = false;
    this.targetPursuitActive = false;
    this.movement.clearFollowTarget();
    this.events.push({ type: "target-deselected" });
    this.markCriticalUiChange();
  }

  private syncEffects(isBurning: boolean): void {
    const boost = this.speedBoost.update(this.simulationTimeMs);
    let effectsMask = 0;
    this.playerEffects.length = 0;

    if (boost.isActive) {
      this.speedBoostEffect.timerProgress = getEffectTimerProgress(
        boost.durationRemainingMs,
        SPEED_BOOST_DURATION_MS,
      );
      this.playerEffects.push(this.speedBoostEffect);
      effectsMask |= 1;
    }

    if (isBurning) {
      this.playerEffects.push(this.burningEffect);
      effectsMask |= 2;
    }

    if (effectsMask !== this.previousEffectsMask) {
      this.previousEffectsMask = effectsMask;
      this.markCriticalUiChange();
    }
  }

  private updatePerformanceLoad(): void {
    const load = this.performanceLoad;

    if (!load) {
      return;
    }

    load.previousPositions.set(load.currentPositions);

    for (let index = 0; index < load.activeCount; index += 1) {
      const positionIndex = index * 2;
      let x =
        load.currentPositions[positionIndex] +
        load.velocities[positionIndex] * SIMULATION_TICK_SECONDS;
      let z =
        load.currentPositions[positionIndex + 1] +
        load.velocities[positionIndex + 1] * SIMULATION_TICK_SECONDS;

      if (x < -44 || x > 44) {
        load.velocities[positionIndex] *= -1;
        x = Math.min(Math.max(x, -44), 44);
      }

      if (z < -44 || z > 44) {
        load.velocities[positionIndex + 1] *= -1;
        z = Math.min(Math.max(z, -44), 44);
      }

      load.currentPositions[positionIndex] = x;
      load.currentPositions[positionIndex + 1] = z;
    }
  }

  private markCriticalUiChange(): void {
    if (!this.criticalUiDirty) {
      this.events.push({ type: "critical-ui-change" });
    }

    this.criticalUiDirty = true;
  }
}
