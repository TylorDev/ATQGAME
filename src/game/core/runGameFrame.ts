import type { GameRuntime } from "./GameRuntime";
import type { RenderFrame } from "./RenderFrame";

export function runGameFrame(
  runtime: GameRuntime,
  deltaSeconds: number,
): Readonly<RenderFrame> {
  return runtime.advanceFrame(deltaSeconds);
}
