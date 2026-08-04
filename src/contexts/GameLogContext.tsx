import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  createGameLogStore,
  type GameLogStore,
} from "@/game/gameLog";

const GameLogContext = createContext<GameLogStore | null>(null);

interface GameLogProviderProps {
  children: ReactNode;
}

export function GameLogProvider({ children }: GameLogProviderProps) {
  const [store] = useState(createGameLogStore);

  return (
    <GameLogContext.Provider value={store}>
      {children}
    </GameLogContext.Provider>
  );
}

function useGameLogStore(): GameLogStore {
  const store = useContext(GameLogContext);

  if (!store) {
    throw new Error("Game log hooks must be used inside GameLogProvider");
  }

  return store;
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

export function useClearGameLog() {
  return useGameLogStore().clear;
}
