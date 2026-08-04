import { describe, expect, it } from "vitest";
import { PlayerVitalityController } from "./combat";

describe("PlayerVitalityController", () => {
  it("reduces damage by the configured defense percentage", () => {
    const noDefense = new PlayerVitalityController({
      maximumHealth: 1_000,
      defensePercent: 0,
    });
    const halfDefense = new PlayerVitalityController({
      maximumHealth: 1_000,
      defensePercent: 50,
    });
    const fullDefense = new PlayerVitalityController({
      maximumHealth: 1_000,
      defensePercent: 100,
    });

    expect(noDefense.applyDamage(100)).toMatchObject({
      effectiveDamage: 100,
      appliedDamage: 100,
      snapshot: { currentHealth: 900 },
    });
    expect(halfDefense.applyDamage(100)).toMatchObject({
      effectiveDamage: 50,
      appliedDamage: 50,
      snapshot: { currentHealth: 950 },
    });
    expect(fullDefense.applyDamage(100)).toMatchObject({
      effectiveDamage: 0,
      appliedDamage: 0,
      snapshot: { currentHealth: 1_000 },
    });
  });

  it("clamps current health when the maximum health is reduced", () => {
    const controller = new PlayerVitalityController({
      maximumHealth: 1_000,
      defensePercent: 0,
    });

    controller.updateSettings({ maximumHealth: 500, defensePercent: 0 });

    expect(controller.getSnapshot()).toMatchObject({
      currentHealth: 500,
      maximumHealth: 500,
    });
  });

  it("restores full health after death and reports the death event", () => {
    const controller = new PlayerVitalityController({
      maximumHealth: 100,
      defensePercent: 0,
    });

    const result = controller.applyDamage(100);

    expect(result.didDie).toBe(true);
    expect(result.appliedDamage).toBe(100);
    expect(result.snapshot).toMatchObject({
      currentHealth: 100,
      maximumHealth: 100,
    });
  });

  it("reports only the health actually lost by an overkill hit", () => {
    const controller = new PlayerVitalityController({
      maximumHealth: 100,
      defensePercent: 0,
    });

    const result = controller.applyDamage(1_000);

    expect(result.effectiveDamage).toBe(1_000);
    expect(result.appliedDamage).toBe(100);
    expect(result.didDie).toBe(true);
  });
});
