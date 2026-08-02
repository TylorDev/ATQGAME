import { useEffect, useState } from "react";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DebugPanel } from "@/components/DebugPanel/DebugPanel";
import { GameCanvas } from "@/components/GameCanvas/GameCanvas";
import { PlayerHud } from "@/components/PlayerHud/PlayerHud";
import {
  getDefaultCameraSettings,
  loadCameraSettings,
  saveCameraSettings,
  type CameraSettings,
} from "@/game/camera";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "@/game/combat";
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
  if (!import.meta.env.DEV) {
    return getDefaultCameraSettings();
  }

  try {
    return loadCameraSettings(window.localStorage);
  } catch {
    return getDefaultCameraSettings();
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

  useEffect(() => {
    if (import.meta.env.DEV) {
      try {
        saveCameraSettings(window.localStorage, cameraSettings);
      } catch {
        // The default values remain usable when localStorage is unavailable.
      }
    }
  }, [cameraSettings]);

  return (
    <Main>
      <VisuallyHidden.Root asChild>
        <h1>Arena RPG: prueba de movimiento</h1>
      </VisuallyHidden.Root>

      <GameCanvas
        cameraSettings={cameraSettings}
        combatSettings={combatSettings}
        debugVisible={import.meta.env.DEV && debugEnabled}
        onDebugStatsChange={setPlayerDebugStats}
        onPlayerHudChange={setPlayerHudState}
        onTestDummyHudChange={setTestDummyHudState}
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

      <PlayerHud state={playerHudState} testDummy={testDummyHudState} />

      <div className={styles.caption} aria-hidden="true">
        Simulación de navegación · Sin rutas automáticas
      </div>
    </Main>
  );
}
