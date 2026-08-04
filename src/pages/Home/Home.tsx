import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { DebugPanel } from "@/components/DebugPanel/DebugPanel";
import { FpsCounter } from "@/components/FpsCounter/FpsCounter";
import { GameCanvas } from "@/components/GameCanvas/GameCanvas";
import { GameConsole } from "@/components/GameConsole/GameConsole";
import { PlayerHud } from "@/components/PlayerHud/PlayerHud";
import { PlayerStatsPanel } from "@/components/PlayerStatsPanel/PlayerStatsPanel";
import { SettingsPanel } from "@/components/SettingsPanel/SettingsPanel";
import { useGameUiSelector, useGameUiStore } from "@/contexts/GameUiContext";
import { Main } from "@/layouts/Main/Main";
import styles from "./Home.module.scss";

export function Home() {
  const store = useGameUiStore();
  const settingsOpen = useGameUiSelector((state) => state.visibility.settings);

  return (
    <Main>
      <VisuallyHidden.Root asChild>
        <h1>Arena RPG: prueba de movimiento</h1>
      </VisuallyHidden.Root>

      <GameCanvas />
      {import.meta.env.DEV ? <DebugPanel /> : null}
      <PlayerHud />
      <GameConsole />
      <FpsCounter />

      <button
        aria-controls="settings-panel"
        aria-expanded={settingsOpen}
        className={styles.settingsButton}
        onClick={store.toggleSettings}
        type="button"
      >
        Settings
      </button>

      <PlayerStatsPanel />
      <SettingsPanel />

      <div className={styles.caption} aria-hidden="true">
        Simulación de navegación · Sin rutas automáticas
      </div>
    </Main>
  );
}
