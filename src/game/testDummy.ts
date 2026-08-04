import {
  PLAYER_AUTO_ATTACK_DAMAGE,
  PLAYER_AUTO_ATTACK_INTERVAL_SECONDS,
  PLAYER_AUTO_ATTACK_RANGE_METERS,
} from "./constants";
import { calculateGroundDistanceMeters } from "./distance";
import type {
  GroundPoint,
  TestDummyDefinition,
  TestDummySnapshot,
} from "./types";

export const TEST_DUMMY_RESPAWN_DURATION_SECONDS = 3;
export const DPS_WINDOW_SECONDS = 1;
const TIME_EPSILON_SECONDS = 1e-6;
const INITIAL_DAMAGE_BUFFER_CAPACITY = 16;

export interface TestDummyStateView extends TestDummySnapshot {}

export interface TestDummyDamageResult {
  appliedDamage: number;
  didDefeat: boolean;
  didApplyDamage: boolean;
}

export class RollingDamageWindow {
  private timestamps: Float64Array;
  private amounts: Float64Array;
  private head = 0;
  private size = 0;
  private total = 0;

  constructor(
    private readonly windowMs: number,
    initialCapacity = INITIAL_DAMAGE_BUFFER_CAPACITY,
  ) {
    const capacity = Math.max(1, Math.floor(initialCapacity));
    this.timestamps = new Float64Array(capacity);
    this.amounts = new Float64Array(capacity);
  }

  push(amount: number, timestampMs: number): void {
    this.prune(timestampMs);

    if (this.size === this.timestamps.length) {
      this.grow();
    }

    const tail = (this.head + this.size) % this.timestamps.length;
    this.timestamps[tail] = timestampMs;
    this.amounts[tail] = amount;
    this.size += 1;
    this.total += amount;
  }

  getTotal(timestampMs: number): number {
    this.prune(timestampMs);
    return this.total;
  }

  reset(): void {
    this.head = 0;
    this.size = 0;
    this.total = 0;
  }

  getCapacity(): number {
    return this.timestamps.length;
  }

  private prune(timestampMs: number): void {
    const windowStartMs = timestampMs - this.windowMs;

    while (
      this.size > 0 &&
      this.timestamps[this.head] <= windowStartMs
    ) {
      this.total -= this.amounts[this.head];
      this.head = (this.head + 1) % this.timestamps.length;
      this.size -= 1;
    }

    if (Math.abs(this.total) <= Number.EPSILON) {
      this.total = 0;
    }
  }

  private grow(): void {
    const nextTimestamps = new Float64Array(this.timestamps.length * 2);
    const nextAmounts = new Float64Array(this.amounts.length * 2);

    for (let index = 0; index < this.size; index += 1) {
      const sourceIndex = (this.head + index) % this.timestamps.length;
      nextTimestamps[index] = this.timestamps[sourceIndex];
      nextAmounts[index] = this.amounts[sourceIndex];
    }

    this.timestamps = nextTimestamps;
    this.amounts = nextAmounts;
    this.head = 0;
  }
}

function sanitizeDamage(damage: number): number {
  return Number.isFinite(damage) ? Math.max(damage, 0) : 0;
}

export function isWithinAutoAttackRange(
  attackerPosition: GroundPoint,
  targetPosition: GroundPoint,
): boolean {
  return (
    calculateGroundDistanceMeters(attackerPosition, targetPosition) <=
    PLAYER_AUTO_ATTACK_RANGE_METERS
  );
}

export class TestDummyController {
  private readonly damageWindow = new RollingDamageWindow(
    DPS_WINDOW_SECONDS * 1_000,
  );
  private readonly state: TestDummyStateView;
  private readonly damageResult: TestDummyDamageResult = {
    appliedDamage: 0,
    didDefeat: false,
    didApplyDamage: false,
  };

  constructor(private readonly definition: TestDummyDefinition) {
    this.state = {
      id: definition.id,
      currentHealth: definition.maximumHealth,
      maximumHealth: definition.maximumHealth,
      lastDamageReceived: 0,
      totalDamageReceived: 0,
      damagePerSecond: 0,
      isDefeated: false,
      respawnRemainingSeconds: 0,
    };
  }

  applyDamage(damage: number, timestampMs: number): TestDummyDamageResult {
    this.updateDamagePerSecond(timestampMs);
    const safeDamage = sanitizeDamage(damage);
    this.damageResult.appliedDamage = 0;
    this.damageResult.didDefeat = false;
    this.damageResult.didApplyDamage = false;

    if (this.state.isDefeated || safeDamage === 0) {
      return this.damageResult;
    }

    const appliedDamage = Math.min(safeDamage, this.state.currentHealth);
    this.state.currentHealth -= appliedDamage;
    this.state.lastDamageReceived = appliedDamage;
    this.state.totalDamageReceived += appliedDamage;
    this.damageWindow.push(appliedDamage, timestampMs);
    this.state.damagePerSecond = this.damageWindow.getTotal(timestampMs);

    const didDefeat = this.state.currentHealth === 0;

    if (didDefeat) {
      this.state.isDefeated = true;
      this.state.respawnRemainingSeconds =
        TEST_DUMMY_RESPAWN_DURATION_SECONDS;
    }

    this.damageResult.appliedDamage = appliedDamage;
    this.damageResult.didDefeat = didDefeat;
    this.damageResult.didApplyDamage = true;
    return this.damageResult;
  }

  step(deltaSeconds: number, timestampMs: number): boolean {
    this.updateDamagePerSecond(timestampMs);

    if (!this.state.isDefeated) {
      return false;
    }

    this.state.respawnRemainingSeconds = Math.max(
      0,
      this.state.respawnRemainingSeconds - Math.max(deltaSeconds, 0),
    );

    if (this.state.respawnRemainingSeconds > TIME_EPSILON_SECONDS) {
      return false;
    }

    this.reset();
    return true;
  }

  getState(timestampMs?: number): TestDummyStateView {
    if (timestampMs !== undefined) {
      this.updateDamagePerSecond(timestampMs);
    }

    return this.state;
  }

  getSnapshot(timestampMs: number): TestDummySnapshot {
    this.updateDamagePerSecond(timestampMs);
    return this.writeSnapshot();
  }

  writeSnapshot(target?: TestDummySnapshot): TestDummySnapshot {
    const snapshot = target ?? { ...this.state };
    snapshot.id = this.state.id;
    snapshot.currentHealth = this.state.currentHealth;
    snapshot.maximumHealth = this.state.maximumHealth;
    snapshot.lastDamageReceived = this.state.lastDamageReceived;
    snapshot.totalDamageReceived = this.state.totalDamageReceived;
    snapshot.damagePerSecond = this.state.damagePerSecond;
    snapshot.isDefeated = this.state.isDefeated;
    snapshot.respawnRemainingSeconds = this.state.respawnRemainingSeconds;
    return snapshot;
  }

  private updateDamagePerSecond(timestampMs: number): void {
    this.state.damagePerSecond = this.damageWindow.getTotal(timestampMs);
  }

  private reset(): void {
    this.state.currentHealth = this.definition.maximumHealth;
    this.state.lastDamageReceived = 0;
    this.state.totalDamageReceived = 0;
    this.state.damagePerSecond = 0;
    this.state.isDefeated = false;
    this.state.respawnRemainingSeconds = 0;
    this.damageWindow.reset();
  }
}

export function createInitialTestDummySnapshot(
  definition: TestDummyDefinition,
): TestDummySnapshot {
  return new TestDummyController(definition).getSnapshot(0);
}

export class AutoAttackController {
  private wasAttackable = false;
  private cooldownRemainingSeconds = 0;

  step(deltaSeconds: number, canAttack: boolean): number {
    if (!canAttack) {
      this.wasAttackable = false;
      return 0;
    }

    if (!this.wasAttackable) {
      this.wasAttackable = true;
      this.cooldownRemainingSeconds = PLAYER_AUTO_ATTACK_INTERVAL_SECONDS;
      return 1;
    }

    this.cooldownRemainingSeconds -= Math.max(deltaSeconds, 0);
    let attacks = 0;

    while (this.cooldownRemainingSeconds <= TIME_EPSILON_SECONDS) {
      attacks += 1;
      this.cooldownRemainingSeconds += PLAYER_AUTO_ATTACK_INTERVAL_SECONDS;
    }

    return attacks;
  }

  getDamagePerAttack(): number {
    return PLAYER_AUTO_ATTACK_DAMAGE;
  }
}
