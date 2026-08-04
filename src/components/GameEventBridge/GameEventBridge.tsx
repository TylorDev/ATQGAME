import { useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { GAME_FRAME_PRIORITY } from "@/components/GameCanvas/framePriorities";
import {
  usePublishAreaPresenceLog,
  usePublishDamageLog,
} from "@/contexts/GameLogContext";
import { useGameRuntimeServices } from "@/contexts/GameRuntimeContext";
import type { GameEvent } from "@/game/core/GameEvent";
import type { TestDummySnapshot } from "@/game/types";

type DeferredGameLogEvent = Extract<
  GameEvent,
  { type: "damage" } | { type: "area-presence" }
>;

interface GameEventBridgeProps {
  onTestDummyHudChange: (state: TestDummySnapshot | null) => void;
}

export function GameEventBridge({
  onTestDummyHudChange,
}: GameEventBridgeProps) {
  const { overheadRegistry, runtime } = useGameRuntimeServices();
  const publishAreaPresence = usePublishAreaPresenceLog();
  const publishDamage = usePublishDamageLog();
  const deferredEventsRef = useRef<DeferredGameLogEvent[]>([]);
  const flushScheduledRef = useRef(false);

  const deferGameLogEvent = useCallback(
    (event: DeferredGameLogEvent): void => {
      deferredEventsRef.current.push(event);

      if (flushScheduledRef.current) {
        return;
      }

      flushScheduledRef.current = true;
      queueMicrotask(() => {
        flushScheduledRef.current = false;
        const pendingEvents = deferredEventsRef.current;

        for (let index = 0; index < pendingEvents.length; index += 1) {
          const pendingEvent = pendingEvents[index];

          if (pendingEvent.type === "damage") {
            publishDamage(pendingEvent.payload);
          } else {
            publishAreaPresence(pendingEvent.payload);
          }
        }

        pendingEvents.length = 0;
      });
    },
    [publishAreaPresence, publishDamage],
  );

  const visitEvent = useCallback(
    (event: GameEvent): void => {
      if (event.type === "damage" || event.type === "area-presence") {
        deferGameLogEvent(event);
        return;
      }

      if (event.type === "vitality-change") {
        overheadRegistry.pushHealthSignal(
          event.receiverId,
          event.healthDelta,
        );
        return;
      }

      if (event.type === "target-deselected") {
        onTestDummyHudChange(null);
      }
    },
    [deferGameLogEvent, onTestDummyHudChange, overheadRegistry],
  );

  useFrame(() => {
    runtime.drainEvents(visitEvent);
  }, GAME_FRAME_PRIORITY.events);

  return null;
}
