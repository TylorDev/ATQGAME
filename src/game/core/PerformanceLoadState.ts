export const PERFORMANCE_LOAD_ACTIVE_ENTITIES = 50;
export const PERFORMANCE_LOAD_VISIBLE_ENTITIES = 100;

export interface PerformanceLoadState {
  readonly previousPositions: Float32Array;
  readonly currentPositions: Float32Array;
  readonly velocities: Float32Array;
  readonly visibleCount: number;
  readonly activeCount: number;
}

export function createPerformanceLoadState(): PerformanceLoadState {
  const previousPositions = new Float32Array(
    PERFORMANCE_LOAD_VISIBLE_ENTITIES * 2,
  );
  const currentPositions = new Float32Array(
    PERFORMANCE_LOAD_VISIBLE_ENTITIES * 2,
  );
  const velocities = new Float32Array(PERFORMANCE_LOAD_ACTIVE_ENTITIES * 2);

  for (let index = 0; index < PERFORMANCE_LOAD_VISIBLE_ENTITIES; index += 1) {
    const column = index % 10;
    const row = Math.floor(index / 10);
    const positionIndex = index * 2;
    currentPositions[positionIndex] = -36 + column * 8;
    currentPositions[positionIndex + 1] = -36 + row * 8;
    previousPositions[positionIndex] = currentPositions[positionIndex];
    previousPositions[positionIndex + 1] = currentPositions[positionIndex + 1];

    if (index < PERFORMANCE_LOAD_ACTIVE_ENTITIES) {
      const angle = index * 2.399963229728653;
      velocities[positionIndex] = Math.cos(angle) * 1.4;
      velocities[positionIndex + 1] = Math.sin(angle) * 1.4;
    }
  }

  return {
    previousPositions,
    currentPositions,
    velocities,
    visibleCount: PERFORMANCE_LOAD_VISIBLE_ENTITIES,
    activeCount: PERFORMANCE_LOAD_ACTIVE_ENTITIES,
  };
}
