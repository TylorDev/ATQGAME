import { GAME_KEYBINDINGS } from "@/game/keybindings";

import styles from "./SettingsPanel.module.scss";

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
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
            <h2 id="settings-title">Keybindings</h2>
          </div>
          <button aria-label="Cerrar settings" className={styles.close} onClick={onClose} type="button">
            ×
          </button>
        </header>

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
