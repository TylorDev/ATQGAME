export const SIMULATION_TICK_SECONDS = 1 / 60;
export const MAX_SIMULATION_STEPS_PER_FRAME = 3;
export const MAX_SIMULATION_FRAME_DELTA_SECONDS = 0.05;

export class GameClock {
  private accumulatorSeconds = 0;

  advanceFrame(deltaSeconds: number, step: () => void): number {
    const safeDeltaSeconds = Math.min(
      Math.max(Number.isFinite(deltaSeconds) ? deltaSeconds : 0, 0),
      MAX_SIMULATION_FRAME_DELTA_SECONDS,
    );
    this.accumulatorSeconds += safeDeltaSeconds;
    let steps = 0;

    while (
      this.accumulatorSeconds + Number.EPSILON >= SIMULATION_TICK_SECONDS &&
      steps < MAX_SIMULATION_STEPS_PER_FRAME
    ) {
      step();
      this.accumulatorSeconds -= SIMULATION_TICK_SECONDS;
      steps += 1;
    }

    if (steps === MAX_SIMULATION_STEPS_PER_FRAME) {
      this.accumulatorSeconds = Math.min(
        Math.max(this.accumulatorSeconds, 0),
        SIMULATION_TICK_SECONDS - Number.EPSILON,
      );
    }

    return Math.min(
      Math.max(this.accumulatorSeconds / SIMULATION_TICK_SECONDS, 0),
      1,
    );
  }

  resetAccumulator(): void {
    this.accumulatorSeconds = 0;
  }
}
