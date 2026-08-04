export const HEALTH_BAR_SEGMENT_COUNT = 5;
export const HEALTH_SIGNAL_DURATION_MS = 1_500;
export const HEALTH_SIGNAL_STACK_SIZE = 3;
export const HEALTH_SIGNAL_GLYPHS = "0123456789+-";
export const HEALTH_SIGNAL_GLYPHS_PER_ROW = 8;
export const HEALTH_SIGNAL_DAMAGE_COLOR = "#f05f57";
export const HEALTH_SIGNAL_RECOVERY_COLOR = "#74d641";
export const HEALTH_SIGNAL_ZERO_COLOR = "#ffffff";
const HEALTH_SIGNAL_MAXIMUM_MAGNITUDE = 9_999_999;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

/** Returns an exact 0–1 health ratio without visual quantization. */
export function getHealthFillRatio(
  currentHealth: number,
  maximumHealth: number,
): number {
  if (maximumHealth <= 0) {
    return 0;
  }

  return clamp(currentHealth / maximumHealth, 0, 1);
}

export function getEffectTimerProgress(
  durationRemainingMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) {
    return 0;
  }

  return clamp(durationRemainingMs / durationMs, 0, 1);
}

export function formatHealthSignalValue(healthDelta: number): string {
  if (!Number.isFinite(healthDelta) || healthDelta === 0) {
    return "0";
  }

  const magnitude = Math.min(
    Math.max(Math.round(Math.abs(healthDelta)), 1),
    HEALTH_SIGNAL_MAXIMUM_MAGNITUDE,
  );
  return `${healthDelta > 0 ? "+" : "-"}${magnitude}`;
}

export function getHealthSignalColor(healthDelta: number): string {
  if (healthDelta > 0) {
    return HEALTH_SIGNAL_RECOVERY_COLOR;
  }

  if (healthDelta < 0) {
    return HEALTH_SIGNAL_DAMAGE_COLOR;
  }

  return HEALTH_SIGNAL_ZERO_COLOR;
}
