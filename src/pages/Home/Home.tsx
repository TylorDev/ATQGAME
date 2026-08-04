import { useCallback, useEffect, useMemo, useState } from "react";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DebugPanel } from "@/components/DebugPanel/DebugPanel";
import { GameCanvas } from "@/components/GameCanvas/GameCanvas";
import { GameConsole } from "@/components/GameConsole/GameConsole";
import { PlayerHud } from "@/components/PlayerHud/PlayerHud";
import { PlayerStatsPanel } from "@/components/PlayerStatsPanel/PlayerStatsPanel";
import { SettingsPanel } from "@/components/SettingsPanel/SettingsPanel";
import {
  adjustCameraDistance,
  getDefaultCameraSettings,
  loadCameraSettings,
  saveCameraSettings,
  type CameraSettings,
} from "@/game/camera";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "@/game/combat";
import {
  CLOSE_OVERLAYS_KEYBINDING,
  isEditableEventTarget,
  PLAYER_STATS_KEYBINDING,
} from "@/game/keybindings";
import {
  getDefaultGraphicsQualitySettings,
  loadGraphicsQualitySettings,
  resolveGraphicsQuality,
  saveGraphicsQualitySettings,
  type GraphicsQualitySettings,
} from "@/game/graphicsQuality";
import {
  loadPlayerName,
  normalizePlayerName,
  savePlayerName,
} from "@/game/playerIdentity";
import {
  DEFAULT_PLAYER_DEBUG_STATS,
  DEFAULT_PLAYER_HUD_STATE,
} from "@/game/playerStats";
import type {
  PlayerCombatSettings,
  PlayerHudState,
  TestDummySnapshot,
} from "@/game/types";
import { Main } from "@/layouts/Main/Main";
import styles from "./Home.module.scss";

function getInitialCameraSettings(): CameraSettings {
  try {
    return loadCameraSettings(window.localStorage);
  } catch {
    return getDefaultCameraSettings();
  }
}

function getInitialPlayerName(): string {
  try {
    return loadPlayerName(window.localStorage);
  } catch {
    return normalizePlayerName(null);
  }
}

function getInitialGraphicsQualitySettings(): GraphicsQualitySettings {
  try {
    return loadGraphicsQualitySettings(window.localStorage);
  } catch {
    return getDefaultGraphicsQualitySettings();
  }
}

export function Home() {
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [cameraSettings, setCameraSettings] =
    useState<CameraSettings>(getInitialCameraSettings);
  const [playerDebugStats, setPlayerDebugStats] = useState(
    DEFAULT_PLAYER_DEBUG_STATS,
  );
  const [combatSettings, setCombatSettings] = useState<PlayerCombatSettings>(
    DEFAULT_PLAYER_COMBAT_SETTINGS,
  );
  const [playerHudState, setPlayerHudState] = useState<PlayerHudState>(
    DEFAULT_PLAYER_HUD_STATE,
  );
  const [testDummyHudState, setTestDummyHudState] =
    useState<TestDummySnapshot | null>(null);
  const [isPlayerStatsOpen, setIsPlayerStatsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [playerName, setPlayerName] = useState(getInitialPlayerName);
  const [graphicsQualitySettings, setGraphicsQualitySettings] =
    useState<GraphicsQualitySettings>(getInitialGraphicsQualitySettings);
  const resolvedGraphicsQuality = useMemo(
    () =>
      resolveGraphicsQuality(
        graphicsQualitySettings,
        window.devicePixelRatio,
      ),
    [graphicsQualitySettings],
  );

  const handleCameraDistanceChange = useCallback(
    (distanceDeltaMeters: number): void => {
      setCameraSettings((currentSettings) =>
        adjustCameraDistance(currentSettings, distanceDeltaMeters),
      );
    },
    [],
  );

  const closeOverlays = useCallback((): void => {
    setIsPlayerStatsOpen(false);
    setIsSettingsOpen(false);
  }, []);

  const toggleSettings = useCallback((): void => {
    setIsSettingsOpen((isOpen) => !isOpen);
    setIsPlayerStatsOpen(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.repeat) {
        return;
      }

      if (event.code === CLOSE_OVERLAYS_KEYBINDING.code) {
        closeOverlays();
        return;
      }

      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (event.code === PLAYER_STATS_KEYBINDING.code) {
        setIsPlayerStatsOpen((isOpen) => !isOpen);
        setIsSettingsOpen(false);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeOverlays]);

  useEffect(() => {
    try {
      saveCameraSettings(window.localStorage, cameraSettings);
    } catch {
      // The default values remain usable when localStorage is unavailable.
    }
  }, [cameraSettings]);

  useEffect(() => {
    try {
      savePlayerName(window.localStorage, playerName);
    } catch {
      // The current name remains usable when localStorage is unavailable.
    }
  }, [playerName]);

  useEffect(() => {
    saveGraphicsQualitySettings(
      window.localStorage,
      graphicsQualitySettings,
    );
  }, [graphicsQualitySettings]);

  const handlePlayerNameChange = useCallback((displayName: string): void => {
    setPlayerName((currentName) => normalizePlayerName(displayName, currentName));
  }, []);

  return (
    <Main>
      <VisuallyHidden.Root asChild>
        <h1>Arena RPG: prueba de movimiento</h1>
      </VisuallyHidden.Root>

      <GameCanvas
        cameraSettings={cameraSettings}
        combatSettings={combatSettings}
        debugVisible={import.meta.env.DEV && debugEnabled}
        playerName={playerName}
        quality={resolvedGraphicsQuality}
        onDebugStatsChange={setPlayerDebugStats}
        onPlayerHudChange={setPlayerHudState}
        onTestDummyHudChange={setTestDummyHudState}
        onCameraDistanceChange={handleCameraDistanceChange}
      />

      {import.meta.env.DEV ? (
        <DebugPanel
          enabled={debugEnabled}
          settings={cameraSettings}
          playerStats={playerDebugStats}
          combatSettings={combatSettings}
          onEnabledChange={setDebugEnabled}
          onSettingsChange={setCameraSettings}
          onCombatSettingsChange={setCombatSettings}
        />
      ) : null}

      <PlayerHud
        state={playerHudState}
        testDummy={testDummyHudState}
        blurEnabled={resolvedGraphicsQuality.hudBlur}
      />

      <GameConsole />

      <button
        aria-controls="settings-panel"
        aria-expanded={isSettingsOpen}
        className={styles.settingsButton}
        onClick={toggleSettings}
        type="button"
      >
        Settings
      </button>

      {isPlayerStatsOpen ? (
        <PlayerStatsPanel
          onClose={() => setIsPlayerStatsOpen(false)}
          playerState={playerHudState}
        />
      ) : null}

      {isSettingsOpen ? (
        <SettingsPanel
          onClose={() => setIsSettingsOpen(false)}
          onPlayerNameChange={handlePlayerNameChange}
          playerName={playerName}
          graphicsQuality={graphicsQualitySettings}
          onGraphicsQualityChange={setGraphicsQualitySettings}
        />
      ) : null}

      <div className={styles.caption} aria-hidden="true">
        Simulación de navegación · Sin rutas automáticas
      </div>
    </Main>
  );
}
