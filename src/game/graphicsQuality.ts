export type GraphicsQualityPreset = "low" | "balanced" | "high";

export interface GraphicsQualitySettings {
  preset: GraphicsQualityPreset;
  adaptiveDpr: boolean;
}

export interface ResolvedGraphicsQuality {
  preset: GraphicsQualityPreset;
  minimumDpr: number;
  maximumDpr: number;
  initialDpr: number;
  shadows: boolean;
  shadowMapSize: 0 | 512 | 1024;
  antialias: boolean;
  hudBlur: boolean;
  adaptiveDpr: boolean;
}

interface GraphicsQualityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface PresetDefinition {
  minimumDpr: number;
  maximumDpr: number;
  preferredDpr: number;
  shadows: boolean;
  shadowMapSize: 0 | 512 | 1024;
  antialias: boolean;
  hudBlur: boolean;
}

export const GRAPHICS_QUALITY_STORAGE_KEY =
  "arena-rpg.graphics-quality.v1";
export const DEFAULT_GRAPHICS_QUALITY_SETTINGS: Readonly<GraphicsQualitySettings> = {
  preset: "balanced",
  adaptiveDpr: true,
};
export const ADAPTIVE_DPR_STEP = 0.125;
export const ADAPTIVE_DPR_OVERLOAD_FRAME_MS = 19;
export const ADAPTIVE_DPR_HEADROOM_FRAME_MS = 15;
export const ADAPTIVE_DPR_OVERLOAD_DURATION_MS = 1_500;
export const ADAPTIVE_DPR_HEADROOM_DURATION_MS = 5_000;
export const ADAPTIVE_DPR_COOLDOWN_MS = 3_000;

const PRESETS: Record<GraphicsQualityPreset, PresetDefinition> = {
  low: {
    minimumDpr: 0.75,
    maximumDpr: 1,
    preferredDpr: 1,
    shadows: false,
    shadowMapSize: 0,
    antialias: false,
    hudBlur: false,
  },
  balanced: {
    minimumDpr: 1,
    maximumDpr: 1.5,
    preferredDpr: 1.25,
    shadows: true,
    shadowMapSize: 512,
    antialias: true,
    hudBlur: false,
  },
  high: {
    minimumDpr: 1.25,
    maximumDpr: 1.75,
    preferredDpr: 1.5,
    shadows: true,
    shadowMapSize: 1024,
    antialias: true,
    hudBlur: true,
  },
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function isGraphicsQualityPreset(
  value: unknown,
): value is GraphicsQualityPreset {
  return value === "low" || value === "balanced" || value === "high";
}

export function getDefaultGraphicsQualitySettings(): GraphicsQualitySettings {
  return { ...DEFAULT_GRAPHICS_QUALITY_SETTINGS };
}

export function normalizeGraphicsQualitySettings(
  value: unknown,
): GraphicsQualitySettings {
  if (!value || typeof value !== "object") {
    return getDefaultGraphicsQualitySettings();
  }

  const candidate = value as Partial<GraphicsQualitySettings>;
  return {
    preset: isGraphicsQualityPreset(candidate.preset)
      ? candidate.preset
      : DEFAULT_GRAPHICS_QUALITY_SETTINGS.preset,
    adaptiveDpr:
      typeof candidate.adaptiveDpr === "boolean"
        ? candidate.adaptiveDpr
        : DEFAULT_GRAPHICS_QUALITY_SETTINGS.adaptiveDpr,
  };
}

export function resolveGraphicsQuality(
  settings: GraphicsQualitySettings,
  devicePixelRatio = 1,
): ResolvedGraphicsQuality {
  const normalized = normalizeGraphicsQualitySettings(settings);
  const preset = PRESETS[normalized.preset];
  const safeDeviceDpr = Number.isFinite(devicePixelRatio)
    ? Math.max(devicePixelRatio, 0.5)
    : 1;
  const initialDpr = clamp(
    Math.min(safeDeviceDpr, preset.preferredDpr),
    preset.minimumDpr,
    preset.maximumDpr,
  );

  return {
    preset: normalized.preset,
    minimumDpr: preset.minimumDpr,
    maximumDpr: preset.maximumDpr,
    initialDpr,
    shadows: preset.shadows,
    shadowMapSize: preset.shadowMapSize,
    antialias: preset.antialias,
    hudBlur: preset.hudBlur,
    adaptiveDpr: normalized.adaptiveDpr,
  };
}

export function parseGraphicsQualitySettings(
  serialized: string | null,
): GraphicsQualitySettings {
  if (!serialized) {
    return getDefaultGraphicsQualitySettings();
  }

  try {
    return normalizeGraphicsQualitySettings(JSON.parse(serialized));
  } catch {
    return getDefaultGraphicsQualitySettings();
  }
}

export function loadGraphicsQualitySettings(
  storage: GraphicsQualityStorage,
): GraphicsQualitySettings {
  try {
    return parseGraphicsQualitySettings(
      storage.getItem(GRAPHICS_QUALITY_STORAGE_KEY),
    );
  } catch {
    return getDefaultGraphicsQualitySettings();
  }
}

export function saveGraphicsQualitySettings(
  storage: GraphicsQualityStorage,
  settings: GraphicsQualitySettings,
): void {
  try {
    storage.setItem(
      GRAPHICS_QUALITY_STORAGE_KEY,
      JSON.stringify(normalizeGraphicsQualitySettings(settings)),
    );
  } catch {
    // The current settings remain usable when storage is unavailable.
  }
}

export class AdaptiveDprController {
  private averageFrameMs = 0;
  private overloadDurationMs = 0;
  private headroomDurationMs = 0;
  private lastChangeAtMs = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly minimumDpr: number,
    private readonly maximumDpr: number,
  ) {}

  recordFrame(
    frameDurationMs: number,
    timestampMs: number,
    currentDpr: number,
  ): number | null {
    if (!Number.isFinite(frameDurationMs) || frameDurationMs <= 0) {
      return null;
    }

    this.averageFrameMs =
      this.averageFrameMs === 0
        ? frameDurationMs
        : this.averageFrameMs * 0.9 + frameDurationMs * 0.1;

    if (timestampMs - this.lastChangeAtMs < ADAPTIVE_DPR_COOLDOWN_MS) {
      this.overloadDurationMs = 0;
      this.headroomDurationMs = 0;
      return null;
    }

    if (this.averageFrameMs > ADAPTIVE_DPR_OVERLOAD_FRAME_MS) {
      this.overloadDurationMs += frameDurationMs;
      this.headroomDurationMs = 0;

      if (
        this.overloadDurationMs >= ADAPTIVE_DPR_OVERLOAD_DURATION_MS &&
        currentDpr > this.minimumDpr
      ) {
        return this.commitChange(
          Math.max(this.minimumDpr, currentDpr - ADAPTIVE_DPR_STEP),
          timestampMs,
        );
      }

      return null;
    }

    if (this.averageFrameMs < ADAPTIVE_DPR_HEADROOM_FRAME_MS) {
      this.headroomDurationMs += frameDurationMs;
      this.overloadDurationMs = 0;

      if (
        this.headroomDurationMs >= ADAPTIVE_DPR_HEADROOM_DURATION_MS &&
        currentDpr < this.maximumDpr
      ) {
        return this.commitChange(
          Math.min(this.maximumDpr, currentDpr + ADAPTIVE_DPR_STEP),
          timestampMs,
        );
      }

      return null;
    }

    this.overloadDurationMs = 0;
    this.headroomDurationMs = 0;
    return null;
  }

  reset(): void {
    this.averageFrameMs = 0;
    this.overloadDurationMs = 0;
    this.headroomDurationMs = 0;
    this.lastChangeAtMs = Number.NEGATIVE_INFINITY;
  }

  private commitChange(nextDpr: number, timestampMs: number): number {
    this.lastChangeAtMs = timestampMs;
    this.overloadDurationMs = 0;
    this.headroomDurationMs = 0;
    return Number(nextDpr.toFixed(3));
  }
}
