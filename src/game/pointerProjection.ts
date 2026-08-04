export function isGroundProjectionActive(pointerId: number | null): boolean {
  return pointerId !== null;
}

export function isHeldGroundProjectionActive(
  pointerId: number | null,
  pressStartedAtMs: number | null,
  timestampMs: number,
  holdDelayMs: number,
): boolean {
  return (
    isGroundProjectionActive(pointerId) &&
    pressStartedAtMs !== null &&
    timestampMs - pressStartedAtMs >= holdDelayMs
  );
}
