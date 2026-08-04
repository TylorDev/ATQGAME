import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import {
  GameUiSnapshotMask,
  UI_PUBLISH_INTERVAL_MS,
} from "@/game/core/GameSnapshot";
import type { PlayerDebugStats } from "@/game/playerStats";
import { UiPublishGate } from "@/game/uiPublishGate";
import type { PlayerHudState, TestDummySnapshot } from "@/game/types";

interface UiSnapshotPublisherProps {
  debugVisible: boolean;
  onDebugStatsChange: (stats: PlayerDebugStats) => void;
  onPlayerHudChange: (state: PlayerHudState) => void;
  onTestDummyHudChange: (state: TestDummySnapshot | null) => void;
}

export function UiSnapshotPublisher({
  debugVisible,
  onDebugStatsChange,
  onPlayerHudChange,
  onTestDummyHudChange,
}: UiSnapshotPublisherProps) {
  const { runtime } = useGameRuntimeServices();
  const publishGateRef = useRef(new UiPublishGate(UI_PUBLISH_INTERVAL_MS));

  useFrame(() => {
    const timestampMs = performance.now();
    const criticalUiChange = runtime.consumeCriticalUiDirty();

    if (!publishGateRef.current.shouldPublish(timestampMs, criticalUiChange)) {
      return;
    }

    const mask = debugVisible
      ? GameUiSnapshotMask.All
      : GameUiSnapshotMask.Player | GameUiSnapshotMask.Target;
    const snapshot = runtime.createUiSnapshot(mask);
    onPlayerHudChange(snapshot.playerHud);

    if (snapshot.targetSelected) {
      onTestDummyHudChange(snapshot.testDummy);
    }

    if (debugVisible) {
      onDebugStatsChange(snapshot.debug);
    }
  }, GAME_FRAME_PRIORITY.ui);

  return null;
}
