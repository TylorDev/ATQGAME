import type { GameRuntime } from "./GameRuntime";
export function runGameFrame(
  runtime: GameRuntime,
  deltaSeconds: number,
): void {
  runtime.advanceFrame(deltaSeconds);
}
