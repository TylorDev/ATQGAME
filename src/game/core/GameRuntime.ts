import { CommandBuffer } from "./CommandBuffer";
import { EventBuffer } from "./EventBuffer";
import { GameClock, SIMULATION_TICK_SECONDS } from "./GameClock";
import type { GameEvent } from "./GameEvent";
import type { GameplayAction } from "./GameplayAction";
import {
  createGameUiSnapshot,
  GameUiSnapshotMask,
  type GameUiSnapshot,
} from "./GameSnapshot";
import type { FixedStepContext, GameSystem } from "./GameSystem";
import {
  createRenderFrame,
  syncRenderFrame,
  type RenderFrame,
} from "./RenderFrame";
import type { WorldState } from "./WorldState";

export class GameRuntime {
  private readonly clock = new GameClock();
  private readonly commands = new CommandBuffer();
  private readonly events = new EventBuffer();
  private readonly renderFrame: RenderFrame;
  private readonly fixedStepContext: FixedStepContext;

  constructor(
    private readonly world: WorldState,
    private readonly systems: readonly GameSystem[],
  ) {
    this.renderFrame = createRenderFrame(world);
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

  advanceFrame(deltaSeconds: number): Readonly<RenderFrame> {
    const interpolationAlpha = this.clock.advanceFrame(
      deltaSeconds,
      () => this.stepFixed(),
    );
    syncRenderFrame(this.renderFrame, this.world, interpolationAlpha);
    return this.renderFrame;
  }

  getRenderFrame(): Readonly<RenderFrame> {
    return this.renderFrame;
  }

  resetFrameAccumulator(): void {
    this.clock.resetAccumulator();
  }

  createUiSnapshot(
    mask: GameUiSnapshotMask = GameUiSnapshotMask.All,
  ): GameUiSnapshot {
    return createGameUiSnapshot(this.world, mask);
  }

  drainEvents(visitor: (event: GameEvent) => void): void {
    this.events.drain(visitor);
  }

  consumeCriticalUiDirty(): boolean {
    const wasDirty = this.world.criticalUiDirty;
    this.world.criticalUiDirty = false;
    return wasDirty;
  }

  private stepFixed(): void {
    this.world.simulationTimeMs += SIMULATION_TICK_SECONDS * 1_000;

    for (let index = 0; index < this.systems.length; index += 1) {
      this.systems[index].step(this.world, this.fixedStepContext);
    }
  }

  private markCriticalUiChange(): void {
    if (!this.world.criticalUiDirty) {
      this.events.push({ type: "critical-ui-change" });
    }

    this.world.criticalUiDirty = true;
  }
}
