import { describe, expect, it } from "vitest";
import {
  PLAYER_AREA_RADIUS_METERS,
  playerAreaTouchesTarget,
} from "./playerArea";

const targetRadiusMeters = 0.72;
const contactDistanceMeters =
  PLAYER_AREA_RADIUS_METERS + targetRadiusMeters;

describe("player area contact", () => {
  it("includes exact contact at 10.72 meters", () => {
    expect(
      playerAreaTouchesTarget(
        { x: 0, z: 0 },
        { x: contactDistanceMeters, z: 0 },
        targetRadiusMeters,
      ),
    ).toBe(true);
  });

  it("rejects a target immediately beyond contact", () => {
    expect(
      playerAreaTouchesTarget(
        { x: 0, z: 0 },
        { x: contactDistanceMeters + 0.000_001, z: 0 },
        targetRadiusMeters,
      ),
    ).toBe(false);
  });

  it("keeps the inclusive threshold on a diagonal", () => {
    const diagonalOffset = contactDistanceMeters / Math.sqrt(2);

    expect(
      playerAreaTouchesTarget(
        { x: 3, z: -2 },
        { x: 3 + diagonalOffset, z: -2 + diagonalOffset },
        targetRadiusMeters,
      ),
    ).toBe(true);
  });
});
