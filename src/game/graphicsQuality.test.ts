import { describe, expect, it } from "vitest";
import {
  AdaptiveDprController,
  GRAPHICS_QUALITY_STORAGE_KEY,
  loadGraphicsQualitySettings,
  resolveGraphicsQuality,
  saveGraphicsQualitySettings,
} from "./graphicsQuality";

describe("graphics quality", () => {
  it("resolves the three presets and uses balanced adaptive quality by default", () => {
    expect(resolveGraphicsQuality({ preset: "low", adaptiveDpr: true }, 2)).toMatchObject({
      minimumDpr: 0.75,
      maximumDpr: 1,
      initialDpr: 1,
      shadows: false,
      antialias: false,
      hudBlur: false,
    });
    expect(resolveGraphicsQuality({ preset: "balanced", adaptiveDpr: true }, 2)).toMatchObject({
      initialDpr: 1.25,
      shadowMapSize: 512,
      hudBlur: false,
    });
    expect(resolveGraphicsQuality({ preset: "high", adaptiveDpr: true }, 2)).toMatchObject({
      initialDpr: 1.5,
      shadowMapSize: 1024,
      hudBlur: true,
    });
  });

  it("persists only the preset and adaptive toggle", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    saveGraphicsQualitySettings(storage, {
      preset: "high",
      adaptiveDpr: false,
    });

    expect(values.has(GRAPHICS_QUALITY_STORAGE_KEY)).toBe(true);
    expect(loadGraphicsQualitySettings(storage)).toEqual({
      preset: "high",
      adaptiveDpr: false,
    });
  });

  it("drops and raises DPR only after the configured hysteresis windows", () => {
    const overload = new AdaptiveDprController(1, 1.5);
    let timestampMs = 0;
    let nextDpr: number | null = null;

    for (let frame = 0; frame < 100 && nextDpr === null; frame += 1) {
      timestampMs += 20;
      nextDpr = overload.recordFrame(20, timestampMs, 1.5);
    }

    expect(nextDpr).toBe(1.375);
    expect(overload.recordFrame(20, timestampMs + 20, 1.375)).toBeNull();

    const headroom = new AdaptiveDprController(1, 1.5);
    timestampMs = 0;
    nextDpr = null;

    for (let frame = 0; frame < 600 && nextDpr === null; frame += 1) {
      timestampMs += 10;
      nextDpr = headroom.recordFrame(10, timestampMs, 1);
    }

    expect(nextDpr).toBe(1.125);
  });
});
