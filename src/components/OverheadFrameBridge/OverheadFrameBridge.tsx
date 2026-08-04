import { useFrame } from "@react-three/fiber";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";

export function OverheadFrameBridge() {
  const { overheadRegistry } = useGameRuntimeServices();

  useFrame(() => {
    overheadRegistry.expireHealthSignals(performance.now());
    overheadRegistry.flush();
  }, GAME_FRAME_PRIORITY.overhead);

  return null;
}
