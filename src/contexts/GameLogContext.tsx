import { useSyncExternalStore } from "react";
import type { GameLogStore } from "@/game/gameLog";
import { useGameUiStore } from "./GameUiContext";

function useGameLogStore(): GameLogStore {
  return useGameUiStore().gameLog;
}

export function useGameLogSnapshot() {
  const store = useGameLogStore();

  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
}

export function useHasGameLogEntries() {
  const store = useGameLogStore();

  return useSyncExternalStore(
    store.subscribe,
    store.getHasEntriesSnapshot,
    store.getHasEntriesSnapshot,
  );
}

export function useGameLogReader() {
  const store = useGameLogStore();

  return {
    getEntry: store.getEntry,
    readEntries: store.readEntries,
  };
}

export function usePublishDamageLog() {
  return useGameLogStore().publishDamage;
}

export function usePublishAreaPresenceLog() {
  return useGameLogStore().publishAreaPresence;
}

export function useClearGameLog() {
  return useGameLogStore().clear;
}
