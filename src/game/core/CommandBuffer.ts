import type { GroundPoint } from "../types";
import type { GameplayAction } from "./GameplayAction";

function copyPoint(target: GroundPoint, source: GroundPoint): void {
  target.x = source.x;
  target.z = source.z;
}

export class CommandBuffer {
  private readonly actions: GameplayAction[] = [];
  private readonly pendingSteerPoint: GroundPoint = { x: 0, z: 0 };
  private hasPendingSteer = false;

  dispatch(action: GameplayAction): void {
    if (action.type === "steer-ground-move") {
      copyPoint(this.pendingSteerPoint, action.point);
      this.hasPendingSteer = true;
      return;
    }

    if (action.type === "start-ground-move") {
      this.actions.push({
        ...action,
        point: { ...action.point },
      });
      return;
    }

    this.actions.push(action);
  }

  drain(visitor: (action: GameplayAction) => void): void {
    for (let index = 0; index < this.actions.length; index += 1) {
      visitor(this.actions[index]);
    }

    this.actions.length = 0;

    if (this.hasPendingSteer) {
      visitor({
        type: "steer-ground-move",
        point: this.pendingSteerPoint,
      });
      this.hasPendingSteer = false;
    }
  }
}
