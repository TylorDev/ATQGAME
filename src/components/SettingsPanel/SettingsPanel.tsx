import { useEffect, useState } from "react";
import { GAME_KEYBINDINGS } from "@/game/keybindings";
import {
  normalizePlayerName,
  PLAYER_NAME_MAX_LENGTH,
} from "@/game/playerIdentity";

import styles from "./SettingsPanel.module.scss";

interface SettingsPanelProps {
  onClose: () => void;
  onPlayerNameChange: (displayName: string) => void;
  playerName: string;
}

export function SettingsPanel({
  onClose,
  onPlayerNameChange,
  playerName,
}: SettingsPanelProps) {
  const [draftName, setDraftName] = useState(playerName);

  useEffect(() => {
    setDraftName(playerName);
  }, [playerName]);

  const commitPlayerName = (): void => {
    const normalizedName = normalizePlayerName(draftName, playerName);
    setDraftName(normalizedName);

    if (normalizedName !== playerName) {
      onPlayerNameChange(normalizedName);
    }
  };

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
          <button aria-label="Cerrar settings" className={styles.close} onClick={onClose} type="button">
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
