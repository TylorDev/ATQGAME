import type { DamageLogEntry, GameLogSnapshot } from "./gameLog";

export interface FrozenGameLogView {
  entries: readonly DamageLogEntry[];
  publishedCount: number;
  discardedCount: number;
  generation: number;
}

export function createFrozenGameLogView(
  snapshot: GameLogSnapshot,
  entries: readonly DamageLogEntry[],
): FrozenGameLogView {
  return {
    entries,
    publishedCount: snapshot.publishedCount,
    discardedCount: snapshot.discardedCount,
    generation: snapshot.generation,
  };
}

export function getFrozenViewNewEntryCount(
  latest: GameLogSnapshot,
  frozen: FrozenGameLogView,
): number {
  if (latest.generation !== frozen.generation) {
    return 0;
  }

  return Math.max(latest.publishedCount - frozen.publishedCount, 0);
}

export function isFrozenViewCurrent(
  latest: GameLogSnapshot,
  frozen: FrozenGameLogView,
): boolean {
  return latest.generation === frozen.generation;
}
