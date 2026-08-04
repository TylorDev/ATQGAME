import { describe, expect, it } from "vitest";
import {
  FPS_DISPLAY_STORAGE_KEY,
  FpsSampler,
  loadFpsVisibility,
  parseFpsVisibility,
  saveFpsVisibility,
} from "./fpsDisplay";

describe("FPS display", () => {
  it("publishes a rounded sample every 500 milliseconds", () => {
    const sampler = new FpsSampler();

    expect(sampler.recordFrame(0)).toBeNull();
    for (let frame = 1; frame < 30; frame += 1) {
      expect(sampler.recordFrame((frame * 500) / 30)).toBeNull();
    }

    expect(sampler.recordFrame(500)).toBe(60);
  });

  it("discards stale and backwards samples", () => {
    const sampler = new FpsSampler();

    sampler.recordFrame(100);
    expect(sampler.recordFrame(2_500)).toBeNull();
    expect(sampler.recordFrame(2_000)).toBeNull();
    expect(sampler.recordFrame(2_500)).toBe(2);
  });

  it("defaults to visible and parses only stored booleans", () => {
    expect(parseFpsVisibility(null)).toBe(true);
    expect(parseFpsVisibility("true")).toBe(true);
    expect(parseFpsVisibility("false")).toBe(false);
    expect(parseFpsVisibility('"false"')).toBe(true);
    expect(parseFpsVisibility("invalid")).toBe(true);
  });

  it("persists visibility and tolerates storage failures", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    saveFpsVisibility(storage, false);
    expect(values.get(FPS_DISPLAY_STORAGE_KEY)).toBe("false");
    expect(loadFpsVisibility(storage)).toBe(false);

    const unavailableStorage = {
      getItem: () => {
        throw new Error("unavailable");
      },
      setItem: () => {
        throw new Error("unavailable");
      },
    };
    expect(loadFpsVisibility(unavailableStorage)).toBe(true);
    expect(() => saveFpsVisibility(unavailableStorage, false)).not.toThrow();
  });
});
