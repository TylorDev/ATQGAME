import { describe, expect, it } from "vitest";
import { calculateGroundDistanceMeters } from "./distance";

describe("calculateGroundDistanceMeters", () => {
  it("returns the horizontal distance in meters", () => {
    expect(
      calculateGroundDistanceMeters({ x: 0, z: 0 }, { x: 3, z: 4 }),
    ).toBe(5);
  });
});
