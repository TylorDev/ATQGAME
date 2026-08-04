import { describe, expect, it } from "vitest";
import { MovementController } from "./MovementController";
import type { ObstacleDefinition } from "./types";

const noObstacles: readonly ObstacleDefinition[] = [];

function advance(
  controller: MovementController,
  frames: number,
  delta: number,
  startTime = 0,
  obstacles = noObstacles,
): void {
  for (let frame = 1; frame <= frames; frame += 1) {
    controller.step(delta, startTime + frame * delta * 1000, obstacles);
  }
}

describe("MovementController", () => {
  it("exposes a destination only after a short click is confirmed", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 4, z: 0 }, 0);
    expect(controller.getSnapshot().isClickTargetConfirmed).toBe(false);

    controller.endRightPress(100);
    expect(controller.getSnapshot()).toMatchObject({
      target: { x: 4, z: 0 },
      isClickTargetConfirmed: true,
    });
  });

  it("removes the debug destination when input becomes a hold", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 4, z: 0 }, 0);
    advance(controller, 4, 0.05);
    const snapshot = controller.getSnapshot();

    expect(snapshot).toMatchObject({
      mode: "holdDirection",
      target: null,
      isClickTargetConfirmed: false,
    });
  });

  it("keeps walking to a short-click destination after release", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 4, z: 0 }, 0);
    controller.endRightPress(100);
    advance(controller, 10, 0.05);

    expect(controller.getSnapshot().mode).toBe("clickToPoint");
    expect(controller.getSnapshot().position.x).toBeCloseTo(2.75);
  });

  it("switches to held movement after the configured delay", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    advance(controller, 4, 0.05);
    const snapshot = controller.getSnapshot();

    expect(snapshot.mode).toBe("holdDirection");
    expect(snapshot.position.x).toBeGreaterThan(0);
  });

  it("updates held direction from the current pointer position", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    advance(controller, 4, 0.05);
    controller.updatePointerGround({ x: 0, z: 10 });
    controller.step(0.05, 230, noObstacles);
    const snapshot = controller.getSnapshot();

    expect(snapshot.position.z).toBeGreaterThan(0);
    expect(snapshot.facing.z).toBeGreaterThan(0.99);
  });

  it("reverses held direction 180 degrees on the next movement step", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    advance(controller, 4, 0.05);
    const positionBeforeTurn = controller.getSnapshot().position.x;
    controller.updatePointerGround({ x: -10, z: 0 });
    controller.step(0.05, 230, noObstacles);
    const snapshot = controller.getSnapshot();

    expect(snapshot.position.x).toBeLessThan(positionBeforeTurn);
    expect(snapshot.facing.x).toBeLessThan(-0.99);
    expect(snapshot.facing.z).toBeCloseTo(0, 5);
  });

  it("reverses the first held press on the next tick before the hold delay", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 5_000);
    controller.step(1 / 60, 0, noObstacles);
    const positionBeforeTurn = controller.getSnapshot().position.x;
    controller.updatePointerGround({ x: -10, z: 0 });
    controller.step(1 / 60, 1_000 / 60, noObstacles);
    const snapshot = controller.getSnapshot();

    expect(snapshot.mode).toBe("clickToPoint");
    expect(snapshot.position.x).toBeLessThan(positionBeforeTurn);
    expect(snapshot.facing.x).toBeLessThan(-0.99);
    expect(snapshot.speedMetersPerSecond).toBeCloseTo(5.5, 5);
  });

  it("enters held mode from simulated elapsed time when clocks are offset", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 5_000);
    advance(controller, 11, 1 / 60, 0);

    expect(controller.getSnapshot().mode).toBe("holdDirection");
  });

  it("confirms the latest pointer point as a short-click destination", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    controller.updatePointerGround({ x: -10, z: 0 });
    controller.endRightPress(100);
    const snapshot = controller.getSnapshot();

    expect(snapshot).toMatchObject({
      mode: "clickToPoint",
      target: { x: -10, z: 0 },
      isClickTargetConfirmed: true,
    });
  });

  it("stops held movement when the button is released", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    advance(controller, 4, 0.05);
    controller.endRightPress(200);
    const before = controller.getSnapshot().position;
    controller.step(0.05, 250, noObstacles);
    const after = controller.getSnapshot().position;

    expect(controller.getSnapshot().mode).toBe("idle");
    expect(after).toEqual(before);
  });

  it("produces frame-rate independent movement", () => {
    const sixtyFps = new MovementController();
    const thirtyFps = new MovementController();

    sixtyFps.beginRightPress({ x: 10, z: 0 }, 0);
    thirtyFps.beginRightPress({ x: 10, z: 0 }, 0);
    sixtyFps.endRightPress(100);
    thirtyFps.endRightPress(100);
    advance(sixtyFps, 60, 1 / 60, 100);
    advance(thirtyFps, 30, 1 / 30, 100);

    expect(sixtyFps.getSnapshot().position.x).toBeCloseTo(5.5, 5);
    expect(thirtyFps.getSnapshot().position.x).toBeCloseTo(5.5, 5);
  });

  it("arrives exactly at a click destination", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 0.5, z: 0 }, 0);
    controller.endRightPress(100);
    advance(controller, 4, 0.05, 100);

    expect(controller.getSnapshot()).toMatchObject({
      mode: "idle",
      position: { x: 0.5, z: 0 },
      target: null,
      isClickTargetConfirmed: false,
    });
  });

  it("stops and cancels click movement when an obstacle blocks it", () => {
    const obstacle: ObstacleDefinition = {
      id: "test-wall",
      xMeters: 1.5,
      zMeters: 0,
      widthMeters: 1,
      depthMeters: 2,
      heightMeters: 1,
    };
    const controller = new MovementController();

    controller.beginRightPress({ x: 5, z: 0 }, 0);
    controller.endRightPress(100);
    advance(controller, 10, 0.05, 100, [obstacle]);
    const blockedPosition = controller.getSnapshot().position;

    expect(controller.getSnapshot().mode).toBe("blocked");
    expect(controller.getSnapshot()).toMatchObject({
      target: null,
      isClickTargetConfirmed: false,
    });

    advance(controller, 5, 0.05, 700, noObstacles);
    expect(controller.getSnapshot().position).toEqual(blockedPosition);
  });

  it("rejects movement beyond arena limits", () => {
    const controller = new MovementController({
      initialPosition: { x: 0.4, z: 0 },
      arenaHalfSizeMeters: 1,
    });

    controller.beginRightPress({ x: 5, z: 0 }, 0);
    controller.endRightPress(100);
    controller.step(0.05, 150, noObstacles);
    const snapshot = controller.getSnapshot();

    expect(snapshot.mode).toBe("blocked");
    expect(snapshot.position.x).toBe(0.4);
  });

  it("can redirect away from an obstacle while held", () => {
    const obstacle: ObstacleDefinition = {
      id: "test-wall",
      xMeters: 1,
      zMeters: 0,
      widthMeters: 0.2,
      depthMeters: 2,
      heightMeters: 1,
    };
    const controller = new MovementController({
      initialPosition: { x: 0.3, z: 0 },
    });

    controller.beginRightPress({ x: 5, z: 0 }, 0);
    advance(controller, 4, 0.05, 0, [obstacle]);
    const blocked = controller.getSnapshot();
    controller.updatePointerGround({ x: 0.3, z: 5 });
    controller.step(0.05, 230, [obstacle]);
    const redirected = controller.getSnapshot();

    expect(blocked.mode).toBe("blocked");
    expect(redirected.mode).toBe("holdDirection");
    expect(redirected.position.z).toBeGreaterThan(0);
  });

  it("cancels all movement on focus loss", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    controller.step(0.05, 180, noObstacles);
    controller.cancelInput();
    const before = controller.getSnapshot().position;
    controller.step(0.05, 230, noObstacles);
    const after = controller.getSnapshot();

    expect(after.mode).toBe("idle");
    expect(after.position).toEqual(before);
    expect(after.target).toBeNull();
    expect(after.isClickTargetConfirmed).toBe(false);
  });

  it("reports the effective ground speed in meters per second", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: 10, z: 0 }, 0);
    controller.endRightPress(100);

    controller.step(0.05, 150, noObstacles, 5.5);
    const walking = controller.getSnapshot();
    controller.step(0.05, 200, noObstacles, 9.9);
    const boosted = controller.getSnapshot();
    controller.step(0.05, 250, noObstacles, 0);
    const stopped = controller.getSnapshot();

    expect(walking.speedMetersPerSecond).toBeCloseTo(5.5, 5);
    expect(boosted.speedMetersPerSecond).toBeCloseTo(9.9, 5);
    expect(stopped.speedMetersPerSecond).toBe(0);
  });

  it("follows a target in a straight line and stops at the requested distance", () => {
    const controller = new MovementController();

    controller.setFollowTarget({ x: 5, z: 0 }, 1);
    advance(controller, 20, 0.05);

    expect(controller.getSnapshot()).toMatchObject({
      mode: "followTarget",
      followTarget: { x: 5, z: 0 },
      position: { x: 4, z: 0 },
      speedMetersPerSecond: 0,
    });
  });

  it("keeps a manual destination after pausing pursuit", () => {
    const controller = new MovementController();

    controller.setFollowTarget({ x: 5, z: 0 }, 1);
    controller.pauseFollowTarget();
    controller.beginRightPress({ x: 2, z: 0 }, 0);
    controller.endRightPress(100);
    advance(controller, 10, 0.05);

    expect(controller.getSnapshot()).toMatchObject({
      mode: "idle",
      followTarget: null,
      position: { x: 2, z: 0 },
    });
  });

  it("resumes pursuit by cancelling a pending manual movement command", () => {
    const controller = new MovementController();

    controller.beginRightPress({ x: -5, z: 0 }, 0);
    controller.endRightPress(100);
    controller.resumeFollowTarget({ x: 5, z: 0 }, 1);
    controller.step(0.05, 150, noObstacles);
    const snapshot = controller.getSnapshot();

    expect(snapshot).toMatchObject({
      mode: "followTarget",
      target: null,
      followTarget: { x: 5, z: 0 },
    });
    expect(snapshot.position.x).toBeGreaterThan(0);
  });

  it("stops pursuit when the direct path is blocked without clearing the target", () => {
    const obstacle: ObstacleDefinition = {
      id: "test-wall",
      xMeters: 2,
      zMeters: 0,
      widthMeters: 1,
      depthMeters: 2,
      heightMeters: 1,
    };
    const controller = new MovementController();

    controller.setFollowTarget({ x: 5, z: 0 }, 1);
    advance(controller, 10, 0.05, 0, [obstacle]);
    const snapshot = controller.getSnapshot();

    expect(snapshot).toMatchObject({
      mode: "blocked",
      followTarget: { x: 5, z: 0 },
    });
    expect(snapshot.position.x).toBeGreaterThan(0);
    expect(snapshot.position.x).toBeLessThan(1.05);
  });
});
