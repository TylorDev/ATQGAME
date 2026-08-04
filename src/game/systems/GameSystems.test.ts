import { describe, expect, it } from "vitest";
import { BURNING_TILE } from "../constants";
import { CommandBuffer } from "../core/CommandBuffer";
import { EventBuffer } from "../core/EventBuffer";
import type { GameEvent } from "../core/GameEvent";
import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import { createDefaultWorld, type WorldState } from "../core/WorldState";
import { AutoAttackSystem } from "./AutoAttackSystem";
import { CommandSystem } from "./CommandSystem";
import { EffectSystem } from "./EffectSystem";
import { HazardSystem } from "./HazardSystem";
import { MovementSystem } from "./MovementSystem";
import { PerformanceLoadSystem } from "./PerformanceLoadSystem";
import { PlayerAreaSystem } from "./PlayerAreaSystem";
import { RespawnSystem } from "./RespawnSystem";
import { TargetingSystem } from "./TargetingSystem";

interface SystemFixture {
  readonly world: WorldState;
  readonly commands: CommandBuffer;
  readonly events: EventBuffer;
  readonly context: FixedStepContext;
}

function createFixture(
  deltaSeconds = 1 / 60,
  performanceLoadEnabled = false,
): SystemFixture {
  const world = createDefaultWorld({
    initialTimeMs: 0,
    wallClockOriginMs: 0,
    performanceLoadEnabled,
  });
  const commands = new CommandBuffer();
  const events = new EventBuffer();
  const context: FixedStepContext = {
    deltaSeconds,
    commands,
    events,
    markCriticalUiChange() {
      world.uiDirty = true;
    },
  };
  return { world, commands, events, context };
}

function runSystem(system: GameSystem, fixture: SystemFixture): void {
  system.step(fixture.world, fixture.context);
}

function drainEvents(events: EventBuffer): GameEvent[] {
  const result: GameEvent[] = [];
  events.drain((event) => result.push(event));
  return result;
}

describe("default game systems", () => {
  it("routes semantic commands to their owning state", () => {
    const fixture = createFixture();
    fixture.commands.dispatch({
      type: "activate-target",
      targetId: fixture.world.target.definition.id,
    });
    fixture.commands.dispatch({
      type: "start-ground-move",
      point: { x: 10, z: 0 },
      timestampMs: 0,
    });

    runSystem(new CommandSystem(), fixture);

    expect(fixture.world.target.selected).toBe(true);
    expect(fixture.world.target.pursuitActive).toBe(false);
    expect(fixture.world.player.movement.getSnapshot().mode).toBe(
      "clickToPoint",
    );
  });

  it("moves after commands and preserves previous/current positions", () => {
    const fixture = createFixture();
    fixture.world.player.movement.beginRightPress({ x: 10, z: 0 }, 0);
    fixture.world.player.movement.endRightPress(100);

    runSystem(new MovementSystem(), fixture);

    expect(fixture.world.player.previousPosition.x).toBe(0);
    expect(fixture.world.player.currentPosition.x).toBeGreaterThan(0);
  });

  it("publishes player-area presence only while active", () => {
    const fixture = createFixture();
    fixture.world.player.areaActive = true;

    runSystem(new PlayerAreaSystem(), fixture);

    expect(drainEvents(fixture.events)).toEqual([
      expect.objectContaining({
        type: "area-presence",
        payload: expect.objectContaining({ status: "inside" }),
      }),
    ]);
  });

  it("deselects a target after movement leaves the allowed distance", () => {
    const fixture = createFixture();
    fixture.world.target.selected = true;
    fixture.world.target.pursuitActive = true;
    fixture.world.player.currentPosition.x = 100;

    runSystem(new TargetingSystem(), fixture);

    expect(fixture.world.target.selected).toBe(false);
    expect(drainEvents(fixture.events)).toContainEqual({
      type: "target-deselected",
    });
  });

  it("respawns the dummy before later combat systems run", () => {
    const fixture = createFixture(3);
    const definition = fixture.world.target.definition;
    fixture.world.target.controller.applyDamage(definition.maximumHealth, 0);
    fixture.world.simulationTimeMs = 3_000;

    runSystem(new RespawnSystem(), fixture);

    expect(fixture.world.target.controller.getSnapshot(3_000).isDefeated).toBe(false);
    expect(drainEvents(fixture.events)).toContainEqual({
      type: "vitality-change",
      receiverId: definition.id,
      healthDelta: definition.maximumHealth,
    });
  });

  it("applies auto-attack damage to a selected in-range target", () => {
    const fixture = createFixture();
    fixture.world.target.selected = true;
    fixture.world.player.currentPosition.x = fixture.world.target.position.x;
    fixture.world.player.currentPosition.z = fixture.world.target.position.z;

    runSystem(new AutoAttackSystem(), fixture);

    expect(
      fixture.world.target.controller.getSnapshot(0).currentHealth,
    ).toBeLessThan(fixture.world.target.definition.maximumHealth);
  });

  it("applies a hazard tick before effects are synchronized", () => {
    const fixture = createFixture(BURNING_TILE.tickIntervalSeconds);
    fixture.world.player.currentPosition.x =
      fixture.world.burningHazardDefinition.xMeters;
    fixture.world.player.currentPosition.z =
      fixture.world.burningHazardDefinition.zMeters;

    runSystem(new HazardSystem(), fixture);
    runSystem(new EffectSystem(), fixture);

    expect(fixture.world.player.vitality.getSnapshot().currentHealth).toBeLessThan(
      fixture.world.player.vitality.getSnapshot().maximumHealth,
    );
    expect(fixture.world.player.effects.map((effect) => effect.id)).toContain(
      "burning",
    );
  });

  it("synchronizes active ability effects", () => {
    const fixture = createFixture();
    fixture.world.player.speedBoost.activate(0);
    fixture.world.simulationTimeMs = 1_000;

    runSystem(new EffectSystem(), fixture);

    expect(fixture.world.player.effects.map((effect) => effect.id)).toEqual([
      "speed-boost",
    ]);
  });

  it("composes boost and burning effects and removes expired effects", () => {
    const fixture = createFixture();
    fixture.world.player.speedBoost.activate(0);
    fixture.world.player.isBurning = true;
    fixture.world.simulationTimeMs = 2_500;

    runSystem(new EffectSystem(), fixture);
    expect(fixture.world.player.effects).toEqual([
      expect.objectContaining({ id: "speed-boost", timerProgress: 0.5 }),
      expect.objectContaining({ id: "burning", timerProgress: 1 }),
    ]);

    fixture.world.player.isBurning = false;
    fixture.world.simulationTimeMs = 5_000;
    runSystem(new EffectSystem(), fixture);
    expect(fixture.world.player.effects).toEqual([]);
  });

  it("updates optional performance entities in stable buffers", () => {
    const fixture = createFixture(1 / 60, true);
    const positions = fixture.world.performanceLoad?.currentPositions;
    const initialX = positions?.[0];

    runSystem(new PerformanceLoadSystem(), fixture);

    expect(fixture.world.performanceLoad?.currentPositions).toBe(positions);
    expect(positions?.[0]).not.toBe(initialX);
  });
});
