import {
  PLAYER_AUTO_ATTACK_DAMAGE,
  PLAYER_AUTO_ATTACK_INTERVAL_SECONDS,
  PLAYER_AUTO_ATTACK_RANGE_METERS,
} from "./constants";
import { calculateGroundDistanceMeters } from "./distance";
import type { GroundPoint, TestDummyDefinition, TestDummySnapshot } from "./types";

export const TEST_DUMMY_RESPAWN_DURATION_SECONDS = 3;
export const DPS_WINDOW_SECONDS = 1;
const TIME_EPSILON_SECONDS = 1e-6;

interface DamageEvent {
  amount: number;
  timestampMs: number;
}

export interface TestDummyStepResult {
  didRespawn: boolean;
  snapshot: TestDummySnapshot;
}

export interface TestDummyDamageResult {
  didDefeat: boolean;
  didApplyDamage: boolean;
  snapshot: TestDummySnapshot;
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
  private currentHealth: number;
  private lastDamageReceived = 0;
  private totalDamageReceived = 0;
  private damageEvents: DamageEvent[] = [];
  private isDefeated = false;
  private respawnRemainingSeconds = 0;

  constructor(private readonly definition: TestDummyDefinition) {
    this.currentHealth = definition.maximumHealth;
  }

  applyDamage(damage: number, timestampMs: number): TestDummyDamageResult {
    this.pruneDamageEvents(timestampMs);
    const safeDamage = sanitizeDamage(damage);

    if (this.isDefeated || safeDamage === 0) {
      return {
        didDefeat: false,
        didApplyDamage: false,
        snapshot: this.getSnapshot(timestampMs),
      };
    }

    const appliedDamage = Math.min(safeDamage, this.currentHealth);
    this.currentHealth -= appliedDamage;
    this.lastDamageReceived = appliedDamage;
    this.totalDamageReceived += appliedDamage;
    this.damageEvents.push({ amount: appliedDamage, timestampMs });

    const didDefeat = this.currentHealth === 0;

    if (didDefeat) {
      this.isDefeated = true;
      this.respawnRemainingSeconds = TEST_DUMMY_RESPAWN_DURATION_SECONDS;
    }

    return {
      didDefeat,
      didApplyDamage: true,
      snapshot: this.getSnapshot(timestampMs),
    };
  }

  step(deltaSeconds: number, timestampMs: number): TestDummyStepResult {
    this.pruneDamageEvents(timestampMs);
    let didRespawn = false;

    if (this.isDefeated) {
      this.respawnRemainingSeconds = Math.max(
        0,
        this.respawnRemainingSeconds - Math.max(deltaSeconds, 0),
      );

      if (this.respawnRemainingSeconds <= TIME_EPSILON_SECONDS) {
        this.respawnRemainingSeconds = 0;
        this.reset();
        didRespawn = true;
      }
    }

    return { didRespawn, snapshot: this.getSnapshot(timestampMs) };
  }

  getSnapshot(timestampMs: number): TestDummySnapshot {
    this.pruneDamageEvents(timestampMs);

    return {
      id: this.definition.id,
      currentHealth: this.currentHealth,
      maximumHealth: this.definition.maximumHealth,
      lastDamageReceived: this.lastDamageReceived,
      totalDamageReceived: this.totalDamageReceived,
      damagePerSecond: this.damageEvents.reduce(
        (totalDamage, event) => totalDamage + event.amount,
        0,
      ),
      isDefeated: this.isDefeated,
      respawnRemainingSeconds: this.respawnRemainingSeconds,
    };
  }

  private pruneDamageEvents(timestampMs: number): void {
    const windowStartMs = timestampMs - DPS_WINDOW_SECONDS * 1_000;
    this.damageEvents = this.damageEvents.filter(
      (event) => event.timestampMs > windowStartMs,
    );
  }

  private reset(): void {
    this.currentHealth = this.definition.maximumHealth;
    this.lastDamageReceived = 0;
    this.totalDamageReceived = 0;
    this.damageEvents = [];
    this.isDefeated = false;
    this.respawnRemainingSeconds = 0;
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
