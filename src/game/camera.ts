export interface CameraSettings {
  distance: number;
  pitchDegrees: number;
}

export interface CameraOffset {
  x: number;
  y: number;
  z: number;
}

interface CameraSettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CAMERA_STORAGE_KEY = "arena-rpg.debug-camera.v1";
export const CAMERA_DISTANCE_MIN = 6;
export const CAMERA_DISTANCE_MAX = 22;
export const CAMERA_DISTANCE_STEP = 0.1;
export const CAMERA_WHEEL_ZOOM_STEP_METERS = 2;
export const CAMERA_PITCH_MIN = 20;
export const CAMERA_PITCH_MAX = 75;
export const CAMERA_PITCH_STEP = 1;
export const CAMERA_YAW_DEGREES = 45;
export const CAMERA_TARGET_HEIGHT = 0.75;

export const DEFAULT_CAMERA_SETTINGS: Readonly<CameraSettings> = {
  distance: 13.4,
  pitchDegrees: 42,
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundToStep(
  value: number,
  minimum: number,
  step: number,
): number {
  const rounded = minimum + Math.round((value - minimum) / step) * step;
  return Number(rounded.toFixed(step < 1 ? 1 : 0));
}

function normalizeValue(
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
  step: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return roundToStep(clamp(value, minimum, maximum), minimum, step);
}

export function getDefaultCameraSettings(): CameraSettings {
  return { ...DEFAULT_CAMERA_SETTINGS };
}

export function normalizeCameraSettings(value: unknown): CameraSettings {
  if (!value || typeof value !== "object") {
    return getDefaultCameraSettings();
  }

  const candidate = value as Partial<CameraSettings>;

  return {
    distance: normalizeValue(
      candidate.distance,
      DEFAULT_CAMERA_SETTINGS.distance,
      CAMERA_DISTANCE_MIN,
      CAMERA_DISTANCE_MAX,
      CAMERA_DISTANCE_STEP,
    ),
    pitchDegrees: normalizeValue(
      candidate.pitchDegrees,
      DEFAULT_CAMERA_SETTINGS.pitchDegrees,
      CAMERA_PITCH_MIN,
      CAMERA_PITCH_MAX,
      CAMERA_PITCH_STEP,
    ),
  };
}

/** Adjusts the camera distance in meters while preserving its inclination. */
export function adjustCameraDistance(
  settings: CameraSettings,
  distanceDeltaMeters: number,
): CameraSettings {
  const normalizedSettings = normalizeCameraSettings(settings);

  return {
    ...normalizedSettings,
    distance: normalizeValue(
      normalizedSettings.distance + distanceDeltaMeters,
      DEFAULT_CAMERA_SETTINGS.distance,
      CAMERA_DISTANCE_MIN,
      CAMERA_DISTANCE_MAX,
      CAMERA_DISTANCE_STEP,
    ),
  };
}

export function parseCameraSettings(serialized: string | null): CameraSettings {
  if (!serialized) {
    return getDefaultCameraSettings();
  }

  try {
    return normalizeCameraSettings(JSON.parse(serialized));
  } catch {
    return getDefaultCameraSettings();
  }
}

export function loadCameraSettings(
  storage: CameraSettingsStorage,
): CameraSettings {
  try {
    return parseCameraSettings(storage.getItem(CAMERA_STORAGE_KEY));
  } catch {
    return getDefaultCameraSettings();
  }
}

export function saveCameraSettings(
  storage: CameraSettingsStorage,
  settings: CameraSettings,
): void {
  try {
    storage.setItem(
      CAMERA_STORAGE_KEY,
      JSON.stringify(normalizeCameraSettings(settings)),
    );
  } catch {
    // Storage can be unavailable for privacy-restricted browser contexts.
  }
}

export function calculateCameraOffset(settings: CameraSettings): CameraOffset {
  const normalized = normalizeCameraSettings(settings);
  const pitch = (normalized.pitchDegrees * Math.PI) / 180;
  const yaw = (CAMERA_YAW_DEGREES * Math.PI) / 180;
  const horizontalDistance = Math.cos(pitch) * normalized.distance;

  return {
    x: Math.sin(yaw) * horizontalDistance,
    y: Math.sin(pitch) * normalized.distance,
    z: Math.cos(yaw) * horizontalDistance,
  };
}
