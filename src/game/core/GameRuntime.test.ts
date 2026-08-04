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
import {
  createMovementRenderBuffer,
  createPerformanceLoadRenderBuffer,
  createPlayerRenderBuffer,
  createTargetRenderBuffer,
} from "./GameRenderReader";
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

  const frame = createPlayerRenderBuffer();
  simulation.renderReader.writePlayer(frame);
  return frame.currentPosition.x;
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
    const player = createPlayerRenderBuffer();
    simulation.renderReader.writePlayer(player);
    const positionBeforeTurn = player.currentPosition.x;

    simulation.dispatch({
      type: "steer-ground-move",
      point: { x: -20, z: 0 },
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);

    const renderState = createMovementRenderBuffer();
    simulation.renderReader.writeMovement(renderState);
    expect(renderState.movement.position.x).toBeLessThan(
      positionBeforeTurn,
    );
    expect(renderState.movement.mode).toBe("clickToPoint");
    expect(renderState.movement.facing.x).toBeLessThan(-0.99);
    expect(renderState.movement.speedMetersPerSecond).toBeCloseTo(5.5, 5);
  });

  it("caps catch-up at three fixed ticks and can discard the accumulator", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });

    const frame = createPlayerRenderBuffer();
    simulation.advanceFrame(1);
    simulation.renderReader.writePlayer(frame);
    expect(frame.simulationTimeMs).toBeCloseTo(50, 5);
    expect(frame.interpolationAlpha).toBeLessThan(1);

    simulation.resetFrameAccumulator();
    simulation.advanceFrame(SIMULATION_TICK_SECONDS / 2);
    simulation.renderReader.writePlayer(frame);
    expect(frame.interpolationAlpha).toBeCloseTo(0.5, 5);
    expect(frame.simulationTimeMs).toBeCloseTo(50, 5);
  });

  it("writes into stable caller-owned render buffers", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    const state = createMovementRenderBuffer();
    const movement = state.movement;
    const position = movement.position;

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    simulation.renderReader.writeMovement(state);

    expect(state.movement).toBe(movement);
    expect(state.movement.position).toBe(position);
    expect(simulation.createUiSnapshot()).not.toBe(
      simulation.createUiSnapshot(),
    );
  });

  it("does not let mutated public render outputs change the world", () => {
    const runtime = createDefaultGameRuntime({
      initialTimeMs: 0,
      performanceLoadEnabled: true,
    });
    runtime.dispatch({ type: "activate-ability", abilityId: "speed-boost" });
    runtime.dispatch({ type: "activate-target", targetId: TEST_DUMMY.id });
    runtime.dispatch({
      type: "start-ground-move",
      point: { x: 10, z: 0 },
      timestampMs: 0,
    });
    runtime.dispatch({ type: "finish-ground-move", timestampMs: 100 });
    runtime.advanceFrame(SIMULATION_TICK_SECONDS);

    const player = createPlayerRenderBuffer();
    const movement = createMovementRenderBuffer();
    const target = createTargetRenderBuffer();
    const load = createPerformanceLoadRenderBuffer();
    runtime.renderReader.writePlayer(player);
    runtime.renderReader.writeMovement(movement);
    runtime.renderReader.writeTarget(target);
    runtime.renderReader.writePerformanceLoad(load);
    const expectedPositionX = player.currentPosition.x;
    const expectedTargetHealth = target.snapshot.currentHealth;
    const expectedLoadX = load.positions[0];

    player.currentPosition.x = 99_999;
    player.combat.currentHealth = -1;
    player.effects[0].id = "mutated";
    movement.movement.position.x = 99_999;
    movement.targetPosition.x = 99_999;
    target.snapshot.currentHealth = -1;
    target.position.x = 99_999;
    load.positions[0] = 99_999;

    runtime.renderReader.writePlayer(player);
    runtime.renderReader.writeMovement(movement);
    runtime.renderReader.writeTarget(target);
    runtime.renderReader.writePerformanceLoad(load);
    expect(player.currentPosition.x).toBe(expectedPositionX);
    expect(player.combat.currentHealth).toBeGreaterThan(0);
    expect(player.effects[0].id).toBe("speed-boost");
    expect(movement.movement.position.x).toBe(expectedPositionX);
    expect(movement.targetPosition.x).toBe(TEST_DUMMY.xMeters);
    expect(target.snapshot.currentHealth).toBe(expectedTargetHealth);
    expect(target.position.x).toBe(TEST_DUMMY.xMeters);
    expect(load.positions[0]).toBe(expectedLoadX);
  });

  it("keeps simultaneous runtimes and readers fully instance-local", () => {
    const first = createDefaultGameRuntime({ initialTimeMs: 0, performanceLoadEnabled: true });
    const second = createDefaultGameRuntime({ initialTimeMs: 0, performanceLoadEnabled: true });
    const firstPlayer = createPlayerRenderBuffer();
    const secondPlayer = createPlayerRenderBuffer();
    const firstTarget = createTargetRenderBuffer();
    const secondTarget = createTargetRenderBuffer();
    const firstLoad = createPerformanceLoadRenderBuffer();
    const secondLoad = createPerformanceLoadRenderBuffer();

    first.dispatch({ type: "activate-ability", abilityId: "speed-boost" });
    first.advanceFrame(SIMULATION_TICK_SECONDS);
    second.advanceFrame(SIMULATION_TICK_SECONDS);
    first.renderReader.writePlayer(firstPlayer);
    second.renderReader.writePlayer(secondPlayer);
    first.renderReader.writeTarget(firstTarget);
    second.renderReader.writeTarget(secondTarget);
    first.renderReader.writePerformanceLoad(firstLoad);
    second.renderReader.writePerformanceLoad(secondLoad);

    expect(firstPlayer.interpolatedPosition).not.toBe(secondPlayer.interpolatedPosition);
    expect(firstPlayer.effects).not.toBe(secondPlayer.effects);
    expect(firstTarget.snapshot).not.toBe(secondTarget.snapshot);
    expect(firstLoad.positions).not.toBe(secondLoad.positions);
    expect(firstPlayer.effects.map((effect) => effect.id)).toEqual(["speed-boost"]);
    expect(secondPlayer.effects).toEqual([]);
  });

  it("starts with the player area disabled and emits no presence events", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    const player = createPlayerRenderBuffer();
    simulation.renderReader.writePlayer(player);
    expect(player.areaActive).toBe(false);
    expect(drainAreaEvents(simulation)).toEqual([]);
  });

  it("toggles the area and reports the initial dummy contact", () => {
    const simulation = createDefaultGameRuntime({
      initialTimeMs: 0,
      wallClockOriginMs: 0,
    });
    simulation.dispatch({ type: "toggle-player-area" });

    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    const player = createPlayerRenderBuffer();
    simulation.renderReader.writePlayer(player);
    expect(player.areaActive).toBe(true);
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

    const player = createPlayerRenderBuffer();
    simulation.renderReader.writePlayer(player);
    expect(player.areaActive).toBe(false);
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
    const load = createPerformanceLoadRenderBuffer();
    expect(simulation.renderReader.writePerformanceLoad(load)).toBe(true);

    expect(load.activeCount).toBe(PERFORMANCE_LOAD_ACTIVE_ENTITIES);
    expect(load.visibleCount).toBe(PERFORMANCE_LOAD_VISIBLE_ENTITIES);
    const positions = load.positions;
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    simulation.renderReader.writePerformanceLoad(load);
    expect(load.positions).toBe(positions);
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
    const load = createPerformanceLoadRenderBuffer();
    runtime.renderReader.writePerformanceLoad(load);
    const initialLoadX = load.positions[0];
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
    const player = createPlayerRenderBuffer();
    runtime.renderReader.writePlayer(player);
    runtime.renderReader.writePerformanceLoad(load);
    expect(player.simulationTimeMs).toBeCloseTo(2_000, 5);
    expect(snapshot.debug.cooldownRemainingMs).toBeLessThan(15_000);
    expect(snapshot.testDummy.currentHealth).toBeLessThan(
      snapshot.testDummy.maximumHealth,
    );
    expect(load.positions[0]).not.toBe(initialLoadX);
  });

  it("emits selection once and exposes the selected target in the UI snapshot", () => {
    const simulation = createDefaultGameRuntime({ initialTimeMs: 0 });
    const eventTypes: string[] = [];
    simulation.consumeUiDirty();
    simulation.dispatch({
      type: "activate-target",
      targetId: TEST_DUMMY.id,
    });
    simulation.advanceFrame(SIMULATION_TICK_SECONDS);
    simulation.drainEvents((event) => eventTypes.push(event.type));

    expect(eventTypes).toContain("target-selected");
    expect(simulation.consumeUiDirty()).toBe(true);
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
