import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameUiStore } from "@/contexts/GameUiContext";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import { UI_PUBLISH_INTERVAL_MS } from "@/game/core/GameSnapshot";
import { UiPublishGate } from "@/game/uiPublishGate";

export function UiSnapshotPublisher() {
  const { runtime } = useGameRuntimeServices();
  const store = useGameUiStore();
  const publishGateRef = useRef(new UiPublishGate(UI_PUBLISH_INTERVAL_MS));

  useFrame(() => {
    const timestampMs = performance.now();
    const criticalUiChange = runtime.consumeUiDirty();

    if (!publishGateRef.current.shouldPublish(timestampMs, criticalUiChange)) {
      return;
    }

    store.publishRuntime(runtime.createUiSnapshot());
  }, GAME_FRAME_PRIORITY.ui);

  return null;
}
