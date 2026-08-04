import type { CommandBuffer } from "./CommandBuffer";
import type { EventBuffer } from "./EventBuffer";
import type { WorldState } from "./WorldState";

export interface FixedStepContext {
  readonly deltaSeconds: number;
  readonly commands: CommandBuffer;
  readonly events: EventBuffer;
  markCriticalUiChange(): void;
}

export interface GameSystem {
  readonly id: string;
  step(world: WorldState, context: FixedStepContext): void;
}
