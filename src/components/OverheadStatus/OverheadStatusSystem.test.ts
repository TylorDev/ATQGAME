import { describe, expect, it } from "vitest";
import { OverheadStatusRegistry } from "./OverheadStatusSystem";

describe("OverheadStatusRegistry", () => {
  it("writes health and effects into reusable instance attributes", () => {
    const registry = new OverheadStatusRegistry(2);
    const registration = registry.register("player");
    registry.update(registration, {
      x: 1,
      y: 2,
      z: 3,
      currentHealth: 25,
      maximumHealth: 100,
      healthColor: "#ff0000",
      effects: [
        {
          id: "speed-boost",
          kind: "buff",
          name: "Speed",
          description: "Fast",
          timerProgress: 0.5,
        },
      ],
    });

    expect(registry.barPosition.getX(registration.slot)).toBe(1);
    expect(registry.barHealth.getX(registration.slot)).toBe(0.25);
    expect(registry.effectVisible.getX(registration.slot * 2)).toBe(1);
    expect(registry.effectProgress.getX(registration.slot * 2)).toBe(0.5);
  });

  it("reuses released slots and enforces its capacity", () => {
    const registry = new OverheadStatusRegistry(1);
    const first = registry.register("first");
    expect(() => registry.register("overflow")).toThrow(/capacity/i);
    registry.unregister(first);
    const second = registry.register("second");
    expect(second.slot).toBe(first.slot);
  });
});
