import { describe, expect, it } from "vitest";
import { BURNING_TILE, TEST_DUMMY } from "./constants";
import type { PublishAreaPresenceLogInput } from "./gameLog";
import {
  GameSimulation,
  PERFORMANCE_LOAD_ACTIVE_ENTITIES,
  PERFORMANCE_LOAD_VISIBLE_ENTITIES,
  SIMULATION_TICK_SECONDS,
} from "./GameSimulation";

function runMovementAtRenderRate(renderFramesPerSecond: number): number {
  const simulation = new GameSimulation({
    initialTimeMs: 0,
    wallClockOriginMs: 0,
  });
  simulation.enqueueCommand({
    type: "begin-right-press",
    point: { x: 20, z: 0 },
    timestampMs: 0,
  });
  simulation.enqueueCommand({
    type: "end-right-press",
    timestampMs: 100,
  });

  for (let frame = 0; frame < renderFramesPerSecond; frame += 1) {
    simulation.advanceFrame(1 / renderFramesPerSecond);
  }

  return simulation.getRenderState().currentPlayerPosition.x;
}

interface VitalityChange {
  receiverId: string;
  healthDelta: number;
}

function advanceUntilVitalityChange(
  simulation: GameSimulation,
  predicate: (change: VitalityChange) => boolean,
  maximumTicks: number,
): VitalityChange[] {
  const changes: VitalityChange[] = [];

  for (let tick = 0; tick < maximumTicks; tick += 1) {
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    let matched = false;
    simulation.drainEvents((event) => {
      if (event.type !== "vitality-change") {
        return;
      }

      const change = {
        receiverId: event.receiverId,
        healthDelta: event.healthDelta,
      };
      changes.push(change);
      matched = predicate(change) || matched;
    });

    if (matched) {
      break;
    }
  }

  return changes;
}

function moveToBurningTile(simulation: GameSimulation): void {
  simulation.enqueueCommand({
    type: "begin-right-press",
    point: { x: BURNING_TILE.xMeters, z: BURNING_TILE.zMeters },
    timestampMs: 0,
  });
  simulation.enqueueCommand({
    type: "end-right-press",
    timestampMs: 100,
  });
}

function drainAreaEvents(
  simulation: GameSimulation,
): PublishAreaPresenceLogInput[] {
  const events: PublishAreaPresenceLogInput[] = [];

  simulation.drainEvents((event) => {
    if (event.type === "area-presence") {
      events.push(event.payload);
    }
  });

  return events;
}

function countAreaEventsAtRenderRate(renderFramesPerSecond: number): number {
  const simulation = new GameSimulation({
    initialTimeMs: 0,
    wallClockOriginMs: 0,
  });
  simulation.enqueueCommand({ type: "toggle-player-area" });
  let eventCount = 0;

  for (let frame = 0; frame < renderFramesPerSecond; frame += 1) {
    simulation.advanceFrame(1 / renderFramesPerSecond);
    eventCount += drainAreaEvents(simulation).length;
  }

  return eventCount;
}

describe("GameSimulation", () => {
  it("produces the same fixed-step movement at 30, 60 and 144 render FPS", () => {
    const atThirty = runMovementAtRenderRate(30);
    const atSixty = runMovementAtRenderRate(60);
    const atOneFortyFour = runMovementAtRenderRate(144);

    expect(atThirty).toBeCloseTo(atSixty, 5);
    expect(atOneFortyFour).toBeCloseTo(atSixty, 5);
  });

  it("redirects the first held input on the next fixed tick without stopping", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });
    simulation.enqueueCommand({
      type: "begin-right-press",
      point: { x: 20, z: 0 },
      timestampMs: 5_000,
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    const positionBeforeTurn =
      simulation.getRenderState().currentPlayerPosition.x;

    simulation.enqueueCommand({
      type: "update-pointer-ground",
      point: { x: -20, z: 0 },
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    const renderState = simulation.getRenderState();
    expect(renderState.currentPlayerPosition.x).toBeLessThan(
      positionBeforeTurn,
    );
    expect(renderState.movement.mode).toBe("clickToPoint");
    expect(renderState.movement.facing.x).toBeLessThan(-0.99);
    expect(renderState.movement.speedMetersPerSecond).toBeCloseTo(5.5, 5);
  });

  it("caps catch-up at three fixed ticks and can discard the accumulator", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });

    const alpha = simulation.advanceFrame(1);
    expect(simulation.getRenderState().simulationTimeMs).toBeCloseTo(50, 5);
    expect(alpha).toBeLessThan(1);

    simulation.resetFrameAccumulator();
    const halfTickAlpha = simulation.advanceFrame(SIMULATION_TICK_SECONDS / 2);
    expect(halfTickAlpha).toBeCloseTo(0.5, 5);
    expect(simulation.getRenderState().simulationTimeMs).toBeCloseTo(50, 5);
  });

  it("keeps render state and hot-path point identities stable", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });
    const state = simulation.getRenderState();
    const movement = state.movement;
    const position = movement.position;

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderState()).toBe(state);
    expect(simulation.getRenderState().movement).toBe(movement);
    expect(simulation.getRenderState().movement.position).toBe(position);
    expect(simulation.createUiSnapshot()).not.toBe(
      simulation.createUiSnapshot(),
    );
  });

  it("starts with the player area disabled and emits no presence events", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderState().playerAreaActive).toBe(false);
    expect(drainAreaEvents(simulation)).toEqual([]);
  });

  it("toggles the area and reports the initial dummy contact", () => {
    const simulation = new GameSimulation({
      initialTimeMs: 0,
      wallClockOriginMs: 0,
    });
    simulation.enqueueCommand({ type: "toggle-player-area" });

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderState().playerAreaActive).toBe(true);
    expect(drainAreaEvents(simulation)).toEqual([
      expect.objectContaining({
        occurredAtMs: SIMULATION_TICK_SECONDS * 1_000,
        status: "inside",
        areaRadiusMeters: 10,
        target: expect.objectContaining({ id: TEST_DUMMY.id }),
      }),
    ]);
  });

  it("emits exactly one area result per fixed tick at any render rate", () => {
    expect(countAreaEventsAtRenderRate(30)).toBe(60);
    expect(countAreaEventsAtRenderRate(60)).toBe(60);
    expect(countAreaEventsAtRenderRate(144)).toBe(60);
  });

  it("emits one deactivation and stops reporting until reactivated", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });
    simulation.enqueueCommand({ type: "toggle-player-area" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    drainAreaEvents(simulation);

    simulation.enqueueCommand({ type: "toggle-player-area" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderState().playerAreaActive).toBe(false);
    expect(drainAreaEvents(simulation).map((event) => event.status)).toEqual([
      "deactivated",
    ]);

    simulation.advanceFrame(SIMULATION_TICK_SECONDS * 3);
    expect(drainAreaEvents(simulation)).toEqual([]);
  });

  it("reports geometry independently of target selection", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });
    simulation.enqueueCommand({ type: "activate-target" });
    simulation.enqueueCommand({ type: "toggle-player-area" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.createUiSnapshot().targetSelected).toBe(true);
    expect(drainAreaEvents(simulation)).toEqual([
      expect.objectContaining({ status: "inside" }),
    ]);
  });

  it("exposes the deterministic 50-active/100-visible load scenario", () => {
    const simulation = new GameSimulation({
      initialTimeMs: 0,
      performanceLoadEnabled: true,
    });
    const load = simulation.getRenderState().performanceLoad;

    expect(load?.activeCount).toBe(PERFORMANCE_LOAD_ACTIVE_ENTITIES);
    expect(load?.visibleCount).toBe(PERFORMANCE_LOAD_VISIBLE_ENTITIES);
    const positions = load?.currentPositions;
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    expect(simulation.getRenderState().performanceLoad?.currentPositions).toBe(
      positions,
    );
  });

  it("emits selection once and exposes the selected target in the UI snapshot", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });
    const eventTypes: string[] = [];
    simulation.consumeCriticalUiDirty();
    simulation.enqueueCommand({ type: "activate-target" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    simulation.drainEvents((event) => eventTypes.push(event.type));

    expect(eventTypes).toContain("target-selected");
    expect(simulation.consumeCriticalUiDirty()).toBe(true);
    expect(simulation.createUiSnapshot().targetSelected).toBe(true);
  });

  it("emits damage and recovery signals when the test dummy respawns", () => {
    const simulation = new GameSimulation({ initialTimeMs: 0 });
    simulation.enqueueCommand({ type: "activate-target" });

    const changes = advanceUntilVitalityChange(
      simulation,
      (change) =>
        change.receiverId === TEST_DUMMY.id && change.healthDelta > 0,
      31_000,
    ).filter((change) => change.receiverId === TEST_DUMMY.id);

    expect(changes[0]).toEqual({
      receiverId: TEST_DUMMY.id,
      healthDelta: -20,
    });
    expect(changes).toContainEqual({
      receiverId: TEST_DUMMY.id,
      healthDelta: TEST_DUMMY.maximumHealth,
    });
  });

  it("emits zero when defense fully negates a valid damage tick", () => {
    const simulation = new GameSimulation({
      initialTimeMs: 0,
      combatSettings: { maximumHealth: 100, defensePercent: 100 },
    });
    moveToBurningTile(simulation);

    const changes = advanceUntilVitalityChange(
      simulation,
      (change) =>
        change.receiverId === "local-player" && change.healthDelta === 0,
      600,
    );

    expect(changes).toContainEqual({
      receiverId: "local-player",
      healthDelta: 0,
    });
  });

  it("emits stacked damage and recovery when the player dies", () => {
    const simulation = new GameSimulation({
      initialTimeMs: 0,
      combatSettings: { maximumHealth: 100, defensePercent: 0 },
    });
    moveToBurningTile(simulation);

    const changes = advanceUntilVitalityChange(
      simulation,
      (change) =>
        change.receiverId === "local-player" && change.healthDelta > 0,
      600,
    ).filter((change) => change.receiverId === "local-player");

    expect(changes.slice(-2)).toEqual([
      { receiverId: "local-player", healthDelta: -100 },
      { receiverId: "local-player", healthDelta: 100 },
    ]);
  });
});
