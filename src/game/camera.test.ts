import { describe, expect, it } from "vitest";
import {
  calculateCameraOffset,
  CAMERA_STORAGE_KEY,
  DEFAULT_CAMERA_SETTINGS,
  loadCameraSettings,
  normalizeCameraSettings,
  parseCameraSettings,
  saveCameraSettings,
} from "./camera";

describe("camera settings", () => {
  it("recreates the original elevated camera offset", () => {
    const offset = calculateCameraOffset({
      distance: 13.4,
      pitchDegrees: 42,
    });

    expect(offset.x).toBeCloseTo(7.04, 2);
    expect(offset.y).toBeCloseTo(8.97, 2);
    expect(offset.z).toBeCloseTo(7.04, 2);
  });

  it("clamps and rounds persisted values to slider ranges", () => {
    expect(
      normalizeCameraSettings({ distance: 30, pitchDegrees: 19.6 }),
    ).toEqual({ distance: 22, pitchDegrees: 20 });
    expect(
      normalizeCameraSettings({ distance: 10.26, pitchDegrees: 45.6 }),
    ).toEqual({ distance: 10.3, pitchDegrees: 46 });
  });

  it("falls back safely for malformed settings", () => {
    expect(parseCameraSettings("not-json")).toEqual(DEFAULT_CAMERA_SETTINGS);
    expect(parseCameraSettings('{"distance":"far"}')).toEqual(
      DEFAULT_CAMERA_SETTINGS,
    );
  });

  it("loads and saves the versioned local settings", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    saveCameraSettings(storage, { distance: 16.24, pitchDegrees: 51 });

    expect(values.has(CAMERA_STORAGE_KEY)).toBe(true);
    expect(loadCameraSettings(storage)).toEqual({
      distance: 16.2,
      pitchDegrees: 51,
    });
  });
});
