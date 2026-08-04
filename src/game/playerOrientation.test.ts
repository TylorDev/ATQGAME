import { describe, expect, it } from "vitest";
import { resolvePointerFacingYaw } from "./playerOrientation";

describe("player pointer orientation", () => {
  const origin = { x: 2, z: 3 };

  it.each([
    ["forward", { x: 2, z: 8 }, 0],
    ["right", { x: 7, z: 3 }, Math.PI / 2],
    ["backward", { x: 2, z: -2 }, Math.PI],
    ["left", { x: -3, z: 3 }, -Math.PI / 2],
  ])("points %s directly at the ground pointer", (_, pointer, expectedYaw) => {
    expect(resolvePointerFacingYaw(0.37, true, origin, pointer)).toBeCloseTo(
      expectedYaw,
      10,
    );
  });

  it("preserves the last yaw when the pointer is no longer active", () => {
    expect(
      resolvePointerFacingYaw(0.73, false, origin, { x: 2, z: -20 }),
    ).toBe(0.73);
  });

  it("preserves the last yaw when the pointer is too close", () => {
    expect(
      resolvePointerFacingYaw(1.2, true, origin, { x: 2.01, z: 3 }),
    ).toBe(1.2);
  });
});
