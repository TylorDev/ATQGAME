import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { getDefaultCameraSettings, loadCameraSettings, saveCameraSettings } from "@/game/camera";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "@/game/combat";
import { loadConsoleWindowState, saveConsoleWindowState } from "@/game/consoleWindow";
import { loadFpsVisibility, saveFpsVisibility } from "@/game/fpsDisplay";
import {
  getDefaultGraphicsQualitySettings,
  loadGraphicsQualitySettings,
  saveGraphicsQualitySettings,
} from "@/game/graphicsQuality";
import { loadPlayerName, normalizePlayerName, savePlayerName } from "@/game/playerIdentity";
import { DEFAULT_PLAYER_DEBUG_STATS, DEFAULT_PLAYER_HUD_STATE } from "@/game/playerStats";
import { AppInputAdapter } from "@/components/AppInputAdapter/AppInputAdapter";
import { UiInputBridge } from "@/components/UiInputBridge/UiInputBridge";
import { InputRouterContext } from "./InputRouterContext";
import { InputRouter } from "@/game/input/InputRouter";
import {
  createGameUiStore,
  type GameUiStore,
  type GameUiState,
} from "@/stores/useGameUiStore";

const GameUiContext = createContext<GameUiStore | null>(null);

function getViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function createBrowserStore(): GameUiStore {
  let camera = getDefaultCameraSettings();
  let graphics = getDefaultGraphicsQualitySettings();
  let playerName = normalizePlayerName(null);
  let fpsVisible = true;

  try {
    camera = loadCameraSettings(window.localStorage);
    graphics = loadGraphicsQualitySettings(window.localStorage);
    playerName = loadPlayerName(window.localStorage);
    fpsVisible = loadFpsVisibility(window.localStorage);
  } catch {
    // In-memory defaults remain available when browser storage is restricted.
  }

  return createGameUiStore({
    runtime: {
      playerHud: DEFAULT_PLAYER_HUD_STATE,
      target: null,
      debug: DEFAULT_PLAYER_DEBUG_STATS,
    },
    camera,
    combat: DEFAULT_PLAYER_COMBAT_SETTINGS,
    playerName,
    graphics,
    fpsVisible,
    consoleWindow: loadConsoleWindowState(window.localStorage, getViewport()),
  });
}

export function GameUiProvider({ children }: { children: ReactNode }) {
  const [store] = useState(createBrowserStore);
  const [inputRouter] = useState(() => new InputRouter(store.isGameplayBlocked));

  useEffect(() => {
    let previous = store.getSnapshot();
    let gameplayWasBlocked = store.isGameplayBlocked();
    return store.subscribe(() => {
      const next = store.getSnapshot();
      if (next.preferences.camera !== previous.preferences.camera) saveCameraSettings(window.localStorage, next.preferences.camera);
      if (next.preferences.playerName !== previous.preferences.playerName) savePlayerName(window.localStorage, next.preferences.playerName);
      if (next.preferences.graphics !== previous.preferences.graphics) saveGraphicsQualitySettings(window.localStorage, next.preferences.graphics);
      if (next.preferences.fpsVisible !== previous.preferences.fpsVisible) saveFpsVisibility(window.localStorage, next.preferences.fpsVisible);
      if (next.consoleWindow !== previous.consoleWindow) saveConsoleWindowState(window.localStorage, next.consoleWindow, getViewport());
      const gameplayIsBlocked = store.isGameplayBlocked();
      if (gameplayIsBlocked && !gameplayWasBlocked) inputRouter.dispatch({ type: "cancel-gameplay" });
      gameplayWasBlocked = gameplayIsBlocked;
      previous = next;
    });
  }, [inputRouter, store]);

  return (
    <GameUiContext.Provider value={store}>
      <InputRouterContext.Provider value={inputRouter}>
        <AppInputAdapter />
        <UiInputBridge />
        {children}
      </InputRouterContext.Provider>
    </GameUiContext.Provider>
  );
}

export function useGameUiStore(): GameUiStore {
  const store = useContext(GameUiContext);
  if (!store) throw new Error("Game UI hooks must be used inside GameUiProvider");
  return store;
}

export function useGameUiSelector<Selection>(
  selector: (state: GameUiState) => Selection,
  equality: (left: Selection, right: Selection) => boolean = Object.is,
): Selection {
  const store = useGameUiStore();
  const cache = useRef<{ snapshot: GameUiState; selection: Selection } | null>(null);
  const selectorRef = useRef(selector);
  const equalityRef = useRef(equality);
  if (selectorRef.current !== selector || equalityRef.current !== equality) {
    cache.current = null;
  }
  selectorRef.current = selector;
  equalityRef.current = equality;

  const getSelection = useCallback(() => {
    const snapshot = store.getSnapshot();
    const previous = cache.current;
    if (previous?.snapshot === snapshot) return previous.selection;
    const selection = selectorRef.current(snapshot);
    if (previous && equalityRef.current(previous.selection, selection)) {
      cache.current = { snapshot, selection: previous.selection };
      return previous.selection;
    }
    cache.current = { snapshot, selection };
    return selection;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}
