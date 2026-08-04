import { describe, expect, it } from "vitest";
import { BURNING_TILE, TEST_DUMMY } from "../constants";
import type { PublishAreaPresenceLogInput } from "../gameLog";
import {
  PERFORMANCE_LOAD_ACTIVE_ENTITIES,
  PERFORMANCE_LOAD_VISIBLE_ENTITIES,
} from "./PerformanceLoadState";
import { SIMULATION_TICK_SECONDS } from "./GameClock";
import { createDefaultGameRuntime } from "./createDefaultGameRuntime";
import type { GameRuntime } from "./GameRuntime";
import { runGameFrame } from "./runGameFrame";
import { createDefaultGameSystems } from "../systems/createDefaultGameSystems";

function runMovementAtRenderRate(renderFramesPerSecond: number): number {
  const simulation = createDefaultGameRuntime({
    initialTimeMs: 0,
    wallClockOriginMs: 0,
  });
  simulation.dispatch({
    type: "start-ground-move",
    point: { x: 20, z: 0 },
    timestampMs: 0,
  });
  simulation.dispatch({
    type: "finish-ground-move",
    timestampMs: 100,
  });

  for (let frame = 0; frame < renderFramesPerSecond; frame += 1) {
    simulation.advanceFrame(1 / renderFramesPerSecond);
  }

  return simulation.getRenderFrame().currentPlayerPosition.x;
}

interface VitalityChange {
  receiverId: string;
  healthDelta: number;
}

function advanceUntilVitalityChange(
  simulation: GameRuntime,
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

function moveToBurningTile(simulation: GameRuntime): void {
  simulation.dispatch({
    type: "start-ground-move",
    point: { x: BURNING_TILE.xMeters, z: BURNING_TILE.zMeters },
    timestampMs: 0,
  });
  simulation.dispatch({
    type: "finish-ground-move",
    timestampMs: 100,
  });
}

function drainAreaEvents(
  simulation: GameRuntime,
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
  const simulation = createDefaultGameRuntime({
    initialTimeMs: 0,
    wallClockOriginMs: 0,
  });
  simulation.dispatch({ type: "toggle-player-area" });
  let eventCount = 0;

  for (let frame = 0; frame < renderFramesPerSecond; frame += 1) {
    simulation.advanceFrame(1 / renderFramesPerSecond);
    eventCount += drainAreaEvents(simulation).length;
  }

  return eventCount;
}

describe("GameRuntime", () => {
  it("produces the same fixed-step movement at 30, 60 and 144 render FPS", () => {
    const atThirty = runMovementAtRenderRate(30);
    const atSixty = runMovementAtRenderRate(60);
    const atOneFortyFour = runMovementAtRenderRate(144);

    expect(atThirty).toBeCloseTo(atSixty, 5);
    expect(atOneFortyFour).toBeCloseTo(atSixty, 5);
  });

  it("redirects the first held input on the next fixed tick without stopping", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    simulation.dispatch({
      type: "start-ground-move",
      point: { x: 20, z: 0 },
      timestampMs: 5_000,
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    const positionBeforeTurn =
      simulation.getRenderFrame().currentPlayerPosition.x;

    simulation.dispatch({
      type: "steer-ground-move",
      point: { x: -20, z: 0 },
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    const renderState = simulation.getRenderFrame();
    expect(renderState.currentPlayerPosition.x).toBeLessThan(
      positionBeforeTurn,
    );
    expect(renderState.movement.mode).toBe("clickToPoint");
    expect(renderState.movement.facing.x).toBeLessThan(-0.99);
    expect(renderState.movement.speedMetersPerSecond).toBeCloseTo(5.5, 5);
  });

  it("caps catch-up at three fixed ticks and can discard the accumulator", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });

    const frame = simulation.advanceFrame(1);
    expect(simulation.getRenderFrame().simulationTimeMs).toBeCloseTo(50, 5);
    expect(frame.interpolationAlpha).toBeLessThan(1);

    simulation.resetFrameAccumulator();
    const halfTickFrame = simulation.advanceFrame(
      SIMULATION_TICK_SECONDS / 2,
    );
    expect(halfTickFrame.interpolationAlpha).toBeCloseTo(0.5, 5);
    expect(simulation.getRenderFrame().simulationTimeMs).toBeCloseTo(50, 5);
  });

  it("keeps render state and hot-path point identities stable", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    const state = simulation.getRenderFrame();
    const movement = state.movement;
    const position = movement.position;

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderFrame()).toBe(state);
    expect(simulation.getRenderFrame().movement).toBe(movement);
    expect(simulation.getRenderFrame().movement.position).toBe(position);
    expect(simulation.createUiSnapshot()).not.toBe(
      simulation.createUiSnapshot(),
    );
  });

  it("starts with the player area disabled and emits no presence events", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderFrame().playerAreaActive).toBe(false);
    expect(drainAreaEvents(simulation)).toEqual([]);
  });

  it("toggles the area and reports the initial dummy contact", () => {
    const simulation = createDefaultGameRuntime({
      initialTimeMs: 0,
      wallClockOriginMs: 0,
    });
    simulation.dispatch({ type: "toggle-player-area" });

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderFrame().playerAreaActive).toBe(true);
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
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    simulation.dispatch({ type: "toggle-player-area" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    drainAreaEvents(simulation);

    simulation.dispatch({ type: "toggle-player-area" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.getRenderFrame().playerAreaActive).toBe(false);
    expect(drainAreaEvents(simulation).map((event) => event.status)).toEqual([
      "deactivated",
    ]);

    simulation.advanceFrame(SIMULATION_TICK_SECONDS * 3);
    expect(drainAreaEvents(simulation)).toEqual([]);
  });

  it("reports geometry independently of target selection", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    simulation.dispatch({
      type: "activate-target",
      targetId: TEST_DUMMY.id,
    });
    simulation.dispatch({ type: "toggle-player-area" });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    expect(simulation.createUiSnapshot().targetSelected).toBe(true);
    expect(drainAreaEvents(simulation)).toEqual([
      expect.objectContaining({ status: "inside" }),
    ]);
  });

  it("exposes the deterministic 50-active/100-visible load scenario", () => {
    const simulation = createDefaultGameRuntime({
      initialTimeMs: 0,
      performanceLoadEnabled: true,
    });
    const load = simulation.getRenderFrame().performanceLoad;

    expect(load?.activeCount).toBe(PERFORMANCE_LOAD_ACTIVE_ENTITIES);
    expect(load?.visibleCount).toBe(PERFORMANCE_LOAD_VISIBLE_ENTITIES);
    const positions = load?.currentPositions;
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    expect(simulation.getRenderFrame().performanceLoad?.currentPositions).toBe(
      positions,
    );
  });

  it("registers systems in the behavior-preserving fixed-step order", () => {
    expect(createDefaultGameSystems(true).map((system) => system.id)).toEqual([
      "commands",
      "movement",
      "player-area",
      "targeting",
      "respawn",
      "auto-attack",
      "hazard",
      "effects",
      "performance-load",
    ]);
  });

  it("advances gameplay through the frame driver without any mounted view", () => {
    const runtime = createDefaultGameRuntime({
      initialTimeMs: 0,
      performanceLoadEnabled: true,
    });
    const load = runtime.getRenderFrame().performanceLoad;
    const initialLoadX = load?.currentPositions[0];
    runtime.dispatch({
      type: "activate-ability",
      abilityId: "speed-boost",
    });
    runtime.dispatch({
      type: "activate-target",
      targetId: TEST_DUMMY.id,
    });

    for (let tick = 0; tick < 120; tick += 1) {
      runGameFrame(runtime, SIMULATION_TICK_SECONDS);
    }

    const snapshot = runtime.createUiSnapshot();
    expect(runtime.getRenderFrame().simulationTimeMs).toBeCloseTo(2_000, 5);
    expect(snapshot.debug.cooldownRemainingMs).toBeLessThan(15_000);
    expect(snapshot.testDummy.currentHealth).toBeLessThan(
      snapshot.testDummy.maximumHealth,
    );
    expect(load?.currentPositions[0]).not.toBe(initialLoadX);
  });

  it("emits selection once and exposes the selected target in the UI snapshot", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    const eventTypes: string[] = [];
    simulation.consumeCriticalUiDirty();
    simulation.dispatch({
      type: "activate-target",
      targetId: TEST_DUMMY.id,
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    simulation.drainEvents((event) => eventTypes.push(event.type));

    expect(eventTypes).toContain("target-selected");
    expect(simulation.consumeCriticalUiDirty()).toBe(true);
    expect(simulation.createUiSnapshot().targetSelected).toBe(true);
  });

  it("emits damage and recovery signals when the test dummy respawns", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    simulation.dispatch({
      type: "activate-target",
      targetId: TEST_DUMMY.id,
    });

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
    const simulation = createDefaultGameRuntime({
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
    const simulation = createDefaultGameRuntime({
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
