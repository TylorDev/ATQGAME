import { describe, expect, it } from "vitest";
import { BURNING_TILE, PLAYER_RADIUS_METERS } from "./constants";
import {
  BurningHazardController,
  circleIntersectsGroundHazard,
} from "./hazards";

function advanceInside(
  controller: BurningHazardController,
  frames: number,
  deltaSeconds = 0.05,
): number {
  let damageTicks = 0;

  for (let frame = 0; frame < frames; frame += 1) {
    damageTicks += controller.step(deltaSeconds, true, 2).damageTicks;
  }

  return damageTicks;
}

describe("burning hazard", () => {
  it("detects the player radius overlapping the burning tile", () => {
    expect(
      circleIntersectsGroundHazard(
        { x: BURNING_TILE.xMeters, z: BURNING_TILE.zMeters },
        PLAYER_RADIUS_METERS,
        BURNING_TILE,
      ),
    ).toBe(true);
    expect(
      circleIntersectsGroundHazard(
        {
          x: BURNING_TILE.xMeters + BURNING_TILE.widthMeters / 2 + 0.3,
          z: BURNING_TILE.zMeters,
        },
        PLAYER_RADIUS_METERS,
        BURNING_TILE,
      ),
    ).toBe(true);
  });

  it("activates immediately but only deals its first tick after two seconds", () => {
    const controller = new BurningHazardController();

    expect(controller.step(0.05, true, 2)).toEqual({
      isActive: true,
      damageTicks: 0,
    });
    expect(advanceInside(controller, 39)).toBe(1);
    expect(advanceInside(controller, 40)).toBe(1);
  });

  it("removes the debuff and restarts its timer when the player leaves", () => {
    const controller = new BurningHazardController();

    advanceInside(controller, 20);
    expect(controller.step(0.05, false, 2)).toEqual({
      isActive: false,
      damageTicks: 0,
    });
    expect(advanceInside(controller, 39)).toBe(0);
    expect(advanceInside(controller, 1)).toBe(1);
  });
});
