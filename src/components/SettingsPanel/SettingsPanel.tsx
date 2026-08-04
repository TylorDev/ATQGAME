import { useEffect, useState } from "react";
import * as Checkbox from "@radix-ui/react-checkbox";
import { useGameUiSelector, useGameUiStore } from "@/contexts/GameUiContext";
import { GAME_KEYBINDINGS } from "@/game/keybindings";
import type {
  GraphicsQualityPreset,
  GraphicsQualitySettings,
} from "@/game/graphicsQuality";
import {
  normalizePlayerName,
  PLAYER_NAME_MAX_LENGTH,
} from "@/game/playerIdentity";

import styles from "./SettingsPanel.module.scss";

const GRAPHICS_QUALITY_OPTIONS: readonly {
  value: GraphicsQualityPreset;
  label: string;
}[] = [
  { value: "low", label: "Bajo" },
  { value: "balanced", label: "Equilibrado" },
  { value: "high", label: "Alto" },
];

export function SettingsPanel() {
  const store = useGameUiStore();
  const isOpen = useGameUiSelector((state) => state.visibility.settings);
  const playerName = useGameUiSelector((state) => state.preferences.playerName);
  const graphicsQuality = useGameUiSelector((state) => state.preferences.graphics);
  const [draftName, setDraftName] = useState(playerName);

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName]);

  const commitPlayerName = (): void => {
    const normalizedName = normalizePlayerName(draftName, playerName);
    setDraftName(normalizedName);

    if (normalizedName !== playerName) {
      store.setPlayerName(normalizedName);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <section
        aria-labelledby="settings-title"
        className={styles.panel}
        id="settings-panel"
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Configuración</p>
            <h2 id="settings-title">Ajustes del juego</h2>
          </div>
          <button aria-label="Cerrar settings" className={styles.close} onClick={store.closeSettings} type="button">
            ×
          </button>
        </header>

        <section className={styles.profile} aria-labelledby="profile-heading">
          <div>
            <h3 id="profile-heading">Perfil local</h3>
            <p>Este nombre identifica al jugador en los registros del mapa.</p>
          </div>
          <label className={styles.field}>
            <span>Nombre del jugador</span>
            <input
              autoComplete="off"
              maxLength={PLAYER_NAME_MAX_LENGTH}
              onBlur={commitPlayerName}
              onChange={(event) => setDraftName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }

                if (event.key === "Escape") {
                  setDraftName(playerName);
                }
              }}
              spellCheck="false"
              type="text"
              value={draftName}
            />
          </label>
        </section>

        <section className={styles.graphics} aria-labelledby="graphics-heading">
          <div>
            <h3 id="graphics-heading">Calidad gráfica</h3>
            <p>
              Equilibrado reduce el coste sostenido sin desactivar iluminación.
            </p>
          </div>
          <label className={styles.field}>
            <span>Preset</span>
            <select
              value={graphicsQuality.preset}
              onChange={(event) =>
                store.setGraphics({
                  ...graphicsQuality,
                  preset: event.target.value as GraphicsQualityPreset,
                })
              }
            >
              {GRAPHICS_QUALITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.toggle}>
            <Checkbox.Root
              className={styles.checkbox}
              checked={graphicsQuality.adaptiveDpr}
              onCheckedChange={(checked) =>
                store.setGraphics({
                  ...graphicsQuality,
                  adaptiveDpr: checked === true,
                })
              }
            >
              <Checkbox.Indicator className={styles.indicator}>
                ✓
              </Checkbox.Indicator>
            </Checkbox.Root>
            <span>Ajustar resolución automáticamente</span>
          </label>
        </section>

        <p className={styles.intro}>Controles disponibles durante la partida.</p>

        <div className={styles.bindings}>
          {GAME_KEYBINDINGS.map((binding) => (
            <article className={styles.binding} key={binding.id}>
              <kbd className={styles.input}>{binding.input}</kbd>
              <div>
                <h3>{binding.label}</h3>
                <p>{binding.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
