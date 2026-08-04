import type { FixedStepContext, GameSystem } from "../core/GameSystem";
import type { WorldState } from "../core/WorldState";

export class PerformanceLoadSystem implements GameSystem {
  readonly id = "performance-load";

  step(world: WorldState, context: FixedStepContext): void {
    const load = world.performanceLoad;

    if (!load) {
      return;
    }

    load.previousPositions.set(load.currentPositions);

    for (let index = 0; index < load.activeCount; index += 1) {
      const positionIndex = index * 2;
      let x =
        load.currentPositions[positionIndex] +
        load.velocities[positionIndex] * context.deltaSeconds;
      let z =
        load.currentPositions[positionIndex + 1] +
        load.velocities[positionIndex + 1] * context.deltaSeconds;

      if (x < -44 || x > 44) {
        load.velocities[positionIndex] *= -1;
        x = Math.min(Math.max(x, -44), 44);
      }

      if (z < -44 || z > 44) {
        load.velocities[positionIndex + 1] *= -1;
        z = Math.min(Math.max(z, -44), 44);
      }

      load.currentPositions[positionIndex] = x;
      load.currentPositions[positionIndex + 1] = z;
    }
  }
}
