import { describe, expect, it } from "vitest";
import {
  isGroundProjectionActive,
  isHeldGroundProjectionActive,
} from "./pointerProjection";

describe("ground pointer projection", () => {
  it("is disabled at rest and active only for a captured pointer", () => {
    expect(isGroundProjectionActive(null)).toBe(false);
    expect(isGroundProjectionActive(0)).toBe(true);
    expect(isGroundProjectionActive(42)).toBe(true);
  });

  it("activates the held projection only after the hold delay", () => {
    expect(isHeldGroundProjectionActive(7, 100, 279, 180)).toBe(false);
    expect(isHeldGroundProjectionActive(7, 100, 280, 180)).toBe(true);
    expect(isHeldGroundProjectionActive(null, 100, 500, 180)).toBe(false);
    expect(isHeldGroundProjectionActive(7, null, 500, 180)).toBe(false);
  });
});
