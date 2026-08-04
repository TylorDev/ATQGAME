export const HEALTH_BAR_SEGMENT_COUNT = 5;

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
