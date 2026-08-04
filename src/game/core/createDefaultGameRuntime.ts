import { createDefaultGameSystems } from "../systems/createDefaultGameSystems";
import { GameRuntime } from "./GameRuntime";
import {
  createDefaultWorld,
  type DefaultWorldOptions,
} from "./WorldState";

export type GameRuntimeOptions = DefaultWorldOptions;

export function createDefaultGameRuntime(
  options: GameRuntimeOptions = {},
): GameRuntime {
  const world = createDefaultWorld(options);
  const systems = createDefaultGameSystems(
    options.performanceLoadEnabled === true,
  );
  return new GameRuntime(world, systems);
}
