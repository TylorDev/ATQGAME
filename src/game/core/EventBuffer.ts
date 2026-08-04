import type { GameEvent } from "./GameEvent";

export class EventBuffer {
  private readonly events: GameEvent[] = [];

  push(event: GameEvent): void {
    this.events.push(event);
  }

  drain(visitor: (event: GameEvent) => void): void {
    for (let index = 0; index < this.events.length; index += 1) {
      visitor(this.events[index]);
    }

    this.events.length = 0;
  }
}
