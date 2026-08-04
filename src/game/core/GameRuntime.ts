import { CommandBuffer } from "./CommandBuffer";
import { EventBuffer } from "./EventBuffer";
import { GameClock, SIMULATION_TICK_SECONDS } from "./GameClock";
import type { GameEvent } from "./GameEvent";
import type { GameplayAction } from "./GameplayAction";
import {
  createGameUiSnapshot,
  type GameUiSnapshot,
} from "./GameSnapshot";
import type { FixedStepContext, GameSystem } from "./GameSystem";
import { GameRenderReader } from "./GameRenderReader";
import type { WorldState } from "./WorldState";

export class GameRuntime {
  private readonly clock = new GameClock();
  private readonly commands = new CommandBuffer();
  private readonly events = new EventBuffer();
  readonly renderReader: GameRenderReader;
  private readonly fixedStepContext: FixedStepContext;
  private interpolationAlpha = 0;

  constructor(
    private readonly world: WorldState,
    private readonly systems: readonly GameSystem[],
  ) {
    this.renderReader = new GameRenderReader(
      world,
      () => this.interpolationAlpha,
    );
    this.fixedStepContext = {
      deltaSeconds: SIMULATION_TICK_SECONDS,
      commands: this.commands,
      events: this.events,
      markCriticalUiChange: () => this.markCriticalUiChange(),
    };
  }

  dispatch(action: GameplayAction): void {
    this.commands.dispatch(action);
  }

  advanceFrame(deltaSeconds: number): void {
    this.interpolationAlpha = this.clock.advanceFrame(
      deltaSeconds,
      () => this.stepFixed(),
    );
  }

  resetFrameAccumulator(): void {
    this.clock.resetAccumulator();
  }

  createUiSnapshot(): GameUiSnapshot {
    return createGameUiSnapshot(this.world);
  }

  drainEvents(visitor: (event: GameEvent) => void): void {
    this.events.drain(visitor);
  }

  consumeUiDirty(): boolean {
    const wasDirty = this.world.uiDirty;
    this.world.uiDirty = false;
    return wasDirty;
  }

  private stepFixed(): void {
    this.world.simulationTimeMs += SIMULATION_TICK_SECONDS * 1_000;

    for (let index = 0; index < this.systems.length; index += 1) {
      this.systems[index].step(this.world, this.fixedStepContext);
    }
  }

  private markCriticalUiChange(): void {
    this.world.uiDirty = true;
  }
}
