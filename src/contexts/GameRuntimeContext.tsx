import {
  createContext,
  useContext,
  type RefObject,
} from "react";
import type { Group, Vector2 } from "three";
import type { OverheadStatusRegistry } from "@/components/OverheadStatus/OverheadStatusSystem";
import type { GameRuntime } from "@/game/core/GameRuntime";
import type { GroundPoint } from "@/game/types";

export interface GameInputFrameState {
  readonly pointerNdc: Vector2;
  pointerId: number | null;
  rightPressStartedAtMs: number | null;
  readonly groundPoint: GroundPoint;
  hasGroundHit: boolean;
  hasPendingFacingPoint: boolean;
  readonly raycastMetrics: {
    ground: number;
    target: number;
  };
}

export interface GameRuntimeServices {
  readonly runtime: GameRuntime;
  readonly overheadRegistry: OverheadStatusRegistry;
  readonly input: GameInputFrameState;
  readonly targetObjectRef: RefObject<Group | null>;
}

export const GameRuntimeContext = createContext<GameRuntimeServices | null>(
  null,
);

export function useGameRuntimeServices(): GameRuntimeServices {
  const services = useContext(GameRuntimeContext);

  if (!services) {
    throw new Error("Game runtime services are unavailable outside GameCanvas.");
  }

  return services;
}
