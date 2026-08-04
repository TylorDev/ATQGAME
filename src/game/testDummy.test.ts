import { describe, expect, it } from "vitest";
import {
  AutoAttackController,
  RollingDamageWindow,
  TestDummyController,
  TEST_DUMMY_RESPAWN_DURATION_SECONDS,
  isWithinAutoAttackRange,
} from "./testDummy";
import type { TestDummyDefinition } from "./types";

const definition: TestDummyDefinition = {
  id: "dummy",
  displayName: "Muñeco de pruebas",
  xMeters: 0,
  zMeters: 0,
  footprintRadiusMeters: 0.72,
  maximumHealth: 100,
};

describe("test dummy combat", () => {
  it("maintains an incremental rolling sum through wrap-around and growth", () => {
    const window = new RollingDamageWindow(1_000, 2);
    window.push(10, 0);
    window.push(20, 100);
    window.push(30, 200);

    expect(window.getCapacity()).toBe(4);
    expect(window.getTotal(999)).toBe(60);
    expect(window.getTotal(1_000)).toBe(50);
    window.push(40, 1_100);
    expect(window.getTotal(1_100)).toBe(70);
    expect(window.getTotal(2_101)).toBe(0);
  });

  it("accepts the inclusive one-meter auto-attack range", () => {
    expect(isWithinAutoAttackRange({ x: 0, z: 0 }, { x: 1, z: 0 })).toBe(true);
    expect(isWithinAutoAttackRange({ x: 0, z: 0 }, { x: 1.001, z: 0 })).toBe(false);
  });

  it("attacks immediately and then once every second while the target is attackable", () => {
    const controller = new AutoAttackController();

    expect(controller.step(0, true)).toBe(1);
    expect(controller.step(0.99, true)).toBe(0);
    expect(controller.step(0.01, true)).toBe(1);
    expect(controller.step(0.5, false)).toBe(0);
    expect(controller.step(0, true)).toBe(1);
  });

  it("tracks the received damage, total damage and rolling one-second DPS", () => {
    const controller = new TestDummyController(definition);

    controller.applyDamage(20, 0);
    expect(controller.getSnapshot(0)).toMatchObject({
      currentHealth: 80,
      lastDamageReceived: 20,
      totalDamageReceived: 20,
      damagePerSecond: 20,
    });

    controller.applyDamage(20, 1_000);
    expect(controller.getSnapshot(1_000).damagePerSecond).toBe(20);
    expect(controller.getSnapshot(2_001).damagePerSecond).toBe(0);
  });

  it("does not accept attacks while defeated and resets after three seconds", () => {
    const controller = new TestDummyController(definition);

    const defeat = controller.applyDamage(100, 0);
    expect(defeat.appliedDamage).toBe(100);
    expect(defeat.didDefeat).toBe(true);
    expect(controller.getSnapshot(0)).toMatchObject({
      currentHealth: 0,
      isDefeated: true,
      totalDamageReceived: 100,
    });
    expect(controller.applyDamage(20, 100).didApplyDamage).toBe(false);

    const waiting = controller.step(TEST_DUMMY_RESPAWN_DURATION_SECONDS - 0.1, 2_900);
    expect(waiting).toBe(false);
    expect(controller.getSnapshot(2_900).isDefeated).toBe(true);

    const respawned = controller.step(0.1, 3_000);
    expect(respawned).toBe(true);
    expect(controller.getSnapshot(3_000)).toMatchObject({
      currentHealth: 100,
      lastDamageReceived: 0,
      totalDamageReceived: 0,
      damagePerSecond: 0,
      isDefeated: false,
    });
  });
});
