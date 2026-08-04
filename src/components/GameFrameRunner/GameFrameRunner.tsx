import { useFrame } from "@react-three/fiber";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import { runGameFrame } from "@/game/core/runGameFrame";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";

export function GameFrameRunner() {
  const { runtime } = useGameRuntimeServices();

  useFrame((_, delta) => {
    runGameFrame(runtime, delta);
  }, GAME_FRAME_PRIORITY.runtime);

  return null;
}
