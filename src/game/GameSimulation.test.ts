import { describe, expect, it } from "vitest";
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
});
