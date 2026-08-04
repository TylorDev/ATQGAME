import type { GameSystem } from "../core/GameSystem";
import { AutoAttackSystem } from "./AutoAttackSystem";
import { CommandSystem } from "./CommandSystem";
import { EffectSystem } from "./EffectSystem";
import { HazardSystem } from "./HazardSystem";
import { MovementSystem } from "./MovementSystem";
import { PerformanceLoadSystem } from "./PerformanceLoadSystem";
import { PlayerAreaSystem } from "./PlayerAreaSystem";
import { RespawnSystem } from "./RespawnSystem";
import { TargetingSystem } from "./TargetingSystem";

export function createDefaultGameSystems(
  performanceLoadEnabled: boolean,
): readonly GameSystem[] {
  const systems: GameSystem[] = [
    new CommandSystem(),
    new MovementSystem(),
    new PlayerAreaSystem(),
    new TargetingSystem(),
    new RespawnSystem(),
    new AutoAttackSystem(),
    new HazardSystem(),
    new EffectSystem(),
  ];

  if (performanceLoadEnabled) {
    systems.push(new PerformanceLoadSystem());
  }

  return systems;
}
