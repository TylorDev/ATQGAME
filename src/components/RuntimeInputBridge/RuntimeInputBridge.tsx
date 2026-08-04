import { useEffect } from "react";
import { useInputRouter } from "@/contexts/InputRouterContext";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";

export function RuntimeInputBridge() {
  const router = useInputRouter();
  const { runtime } = useGameRuntimeServices();

  useEffect(() => {
    const handle = (action: Parameters<typeof router.dispatch>[0]): boolean => {
      switch (action.type) {
        case "activate-speed-boost":
          runtime.dispatch({ type: "activate-ability", abilityId: "speed-boost" });
          return true;
        case "toggle-player-area":
          runtime.dispatch({ type: "toggle-player-area" });
          return true;
        case "activate-target":
          runtime.dispatch({ type: "activate-target", targetId: action.targetId });
          return true;
        case "start-ground-move":
          runtime.dispatch({ type: "start-ground-move", point: action.point, timestampMs: action.timestampMs });
          return true;
        case "steer-ground-move":
          runtime.dispatch({ type: "steer-ground-move", point: action.point });
          return true;
        case "finish-ground-move":
          runtime.dispatch({ type: "finish-ground-move", timestampMs: action.timestampMs });
          return true;
        default:
          return false;
      }
    };
    return router.subscribe("gameplay", handle);
  }, [router, runtime]);

  useEffect(() => router.subscribe("global", (action) => {
    if (action.type !== "cancel-gameplay") return false;
    runtime.dispatch({ type: "cancel-gameplay-input" });
    runtime.resetFrameAccumulator();
    return true;
  }), [router, runtime]);

  return null;
}
