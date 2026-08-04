import { describe, expect, it } from "vitest";
import {
  HEALTH_SIGNAL_GLYPHS,
  HEALTH_SIGNAL_GLYPHS_PER_ROW,
  HEALTH_SIGNAL_STACK_SIZE,
} from "../../game/overheadStatus";
import { OverheadStatusRegistry } from "./OverheadStatusSystem";

function readSignalRow(
  registry: OverheadStatusRegistry,
  slot: number,
  row: number,
): string {
  const base =
    (slot * HEALTH_SIGNAL_STACK_SIZE + row) *
    HEALTH_SIGNAL_GLYPHS_PER_ROW;
  let value = "";

  for (let glyph = 0; glyph < HEALTH_SIGNAL_GLYPHS_PER_ROW; glyph += 1) {
    const index = base + glyph;

    if (registry.signalVisible.getX(index) < 0.5) {
      continue;
    }

    value += HEALTH_SIGNAL_GLYPHS.charAt(
      registry.signalGlyph.getX(index),
    );
  }

  return value;
}

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

  it("stacks the latest three health signals closest to the bar", () => {
    const registry = new OverheadStatusRegistry(2);
    const player = registry.register("player");
    const dummy = registry.register("dummy");
    registry.update(player, {
      x: 1,
      y: 2,
      z: 3,
      currentHealth: 100,
      maximumHealth: 100,
      effects: [],
    });

    registry.pushHealthSignal("player", 0, 0);
    registry.pushHealthSignal("player", 25, 100);
    registry.pushHealthSignal("player", -40, 200);

    expect(readSignalRow(registry, player.slot, 0)).toBe("-40");
    expect(readSignalRow(registry, player.slot, 1)).toBe("+25");
    expect(readSignalRow(registry, player.slot, 2)).toBe("0");

    registry.pushHealthSignal("player", 5, 300);
    registry.pushHealthSignal("dummy", -10, 300);

    expect(readSignalRow(registry, player.slot, 0)).toBe("+5");
    expect(readSignalRow(registry, player.slot, 1)).toBe("-40");
    expect(readSignalRow(registry, player.slot, 2)).toBe("+25");
    expect(readSignalRow(registry, dummy.slot, 0)).toBe("-10");
  });

  it("updates active signal positions and hides them exactly after 1.5 seconds", () => {
    const registry = new OverheadStatusRegistry(1);
    const registration = registry.register("player");
    registry.update(registration, {
      x: 1,
      y: 2,
      z: 3,
      currentHealth: 100,
      maximumHealth: 100,
      effects: [],
    });
    registry.pushHealthSignal("player", -10, 100);
    registry.update(registration, {
      x: 4,
      y: 5,
      z: 6,
      currentHealth: 90,
      maximumHealth: 100,
      effects: [],
    });

    const glyphBase =
      registration.slot *
      HEALTH_SIGNAL_STACK_SIZE *
      HEALTH_SIGNAL_GLYPHS_PER_ROW;
    expect(registry.signalPosition.getX(glyphBase)).toBe(4);
    expect(registry.signalPosition.getY(glyphBase)).toBe(5);
    expect(registry.signalPosition.getZ(glyphBase)).toBe(6);

    registry.expireHealthSignals(1_599);
    expect(readSignalRow(registry, registration.slot, 0)).toBe("-10");
    registry.expireHealthSignals(1_600);
    expect(readSignalRow(registry, registration.slot, 0)).toBe("");
  });

  it("clears queued signals before a released slot is reused", () => {
    const registry = new OverheadStatusRegistry(1);
    const first = registry.register("first");
    registry.pushHealthSignal("first", -10, 0);
    registry.unregister(first);
    const second = registry.register("second");

    expect(second.slot).toBe(first.slot);
    expect(readSignalRow(registry, second.slot, 0)).toBe("");
  });
});
