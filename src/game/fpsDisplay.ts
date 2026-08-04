export const FPS_DISPLAY_STORAGE_KEY = "arena-rpg.fps-display.v1";
export const FPS_SAMPLE_WINDOW_MS = 500;
export const FPS_STALE_GAP_MS = 2_000;

interface FpsDisplayStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function parseFpsVisibility(serialized: string | null): boolean {
  if (serialized === null) {
    return true;
  }

  try {
    const value: unknown = JSON.parse(serialized);
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
}

export function loadFpsVisibility(storage: FpsDisplayStorage): boolean {
  try {
    return parseFpsVisibility(storage.getItem(FPS_DISPLAY_STORAGE_KEY));
  } catch {
    return true;
  }
}

export function saveFpsVisibility(
  storage: FpsDisplayStorage,
  visible: boolean,
): void {
  try {
    storage.setItem(FPS_DISPLAY_STORAGE_KEY, JSON.stringify(visible));
  } catch {
    // The in-memory preference remains usable when storage is unavailable.
  }
}

export class FpsSampler {
  private windowStartedAtMs: number | null = null;
  private frameCount = 0;

  recordFrame(timestampMs: number): number | null {
    if (!Number.isFinite(timestampMs)) {
      return null;
    }

    if (this.windowStartedAtMs === null) {
      this.windowStartedAtMs = timestampMs;
      return null;
    }

    const elapsedMs = timestampMs - this.windowStartedAtMs;

    if (elapsedMs < 0 || elapsedMs > FPS_STALE_GAP_MS) {
      this.reset(timestampMs);
      return null;
    }

    this.frameCount += 1;

    if (elapsedMs < FPS_SAMPLE_WINDOW_MS) {
      return null;
    }

    const framesPerSecond = Math.round(
      (this.frameCount * 1_000) / elapsedMs,
    );
    this.reset(timestampMs);
    return framesPerSecond;
  }

  reset(timestampMs?: number): void {
    this.windowStartedAtMs =
      typeof timestampMs === "number" && Number.isFinite(timestampMs)
        ? timestampMs
        : null;
    this.frameCount = 0;
  }
}
