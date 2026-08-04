import { describe, expect, it } from "vitest";
import {
  calculateMovementSpeedMetersPerSecond,
  getCurrentPlayerSpeedMetersPerSecond,
  SPEED_BOOST_MODIFIER,
  SpeedBoostController,
} from "./playerStats";

describe("player speed stats", () => {
  it("applies speed multipliers to the 5.5 m/s base speed", () => {
    expect(calculateMovementSpeedMetersPerSecond(5.5, [])).toBe(5.5);
    expect(
      calculateMovementSpeedMetersPerSecond(5.5, [SPEED_BOOST_MODIFIER]),
    ).toBeCloseTo(9.9, 5);
  });

  it("activates the speed boost for five seconds and starts cooldown immediately", () => {
    const controller = new SpeedBoostController();

    expect(controller.activate(0)).toBe(true);
    expect(controller.getSnapshot(4_999)).toMatchObject({
      isActive: true,
      durationRemainingMs: 1,
      cooldownRemainingMs: 10_001,
    });
    expect(controller.getSnapshot(5_000)).toMatchObject({
      isActive: false,
      durationRemainingMs: 0,
      cooldownRemainingMs: 10_000,
    });
  });

  it("does not stack or refresh the buff before the 15-second cooldown ends", () => {
    const controller = new SpeedBoostController();

    controller.activate(0);

    expect(controller.activate(4_000)).toBe(false);
    expect(controller.activate(14_999)).toBe(false);
    expect(controller.activate(15_000)).toBe(true);
    expect(getCurrentPlayerSpeedMetersPerSecond(controller.getSnapshot(15_000))).toBeCloseTo(
      9.9,
      5,
    );
  });

  it("writes speed snapshots without exposing controller state", () => {
    const controller = new SpeedBoostController();
    controller.activate(0);
    const snapshot = controller.getSnapshot(1_000);
    snapshot.durationRemainingMs = -1;

    expect(controller.getSnapshot(1_000).durationRemainingMs).toBe(4_000);
  });

});
