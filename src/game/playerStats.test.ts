import { describe, expect, it } from "vitest";
import {
  calculateMovementSpeedMetersPerSecond,
  getActivePlayerEffects,
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

  it("exposes speed boost and burning as separate active effects", () => {
    const speedBoost = new SpeedBoostController();

    speedBoost.activate(0);

    expect(getActivePlayerEffects(speedBoost.getSnapshot(0), true)).toEqual([
      expect.objectContaining({
        id: "speed-boost",
        kind: "buff",
        timerProgress: 1,
      }),
      expect.objectContaining({
        id: "burning",
        kind: "debuff",
        timerProgress: 1,
      }),
    ]);
  });

  it("updates the impulse ring while the buff is active and removes it on expiry", () => {
    const speedBoost = new SpeedBoostController();

    speedBoost.activate(0);

    expect(getActivePlayerEffects(speedBoost.getSnapshot(2_500), false)).toEqual([
      expect.objectContaining({ id: "speed-boost", timerProgress: 0.5 }),
    ]);
    expect(getActivePlayerEffects(speedBoost.getSnapshot(5_000), false)).toEqual([]);
  });
});
