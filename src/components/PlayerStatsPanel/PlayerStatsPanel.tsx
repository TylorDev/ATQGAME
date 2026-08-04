import type { PlayerHudState } from "@/game/types";
import {
  getActivePlayerStats,
  PLAYER_PLACEHOLDER_STAT_CATEGORIES,
  type PlayerStatPresentation,
} from "@/game/playerPresentation";

import styles from "./PlayerStatsPanel.module.scss";

interface PlayerStatsPanelProps {
  playerState: PlayerHudState;
  onClose: () => void;
}

function formatValue(stat: PlayerStatPresentation) {
  const value = Number.isInteger(stat.value)
    ? stat.value.toLocaleString("es-ES")
    : stat.value.toLocaleString("es-ES", {
        maximumFractionDigits: 1,
      });

  return `${value} ${stat.unit}`;
}

function StatRow({ stat }: { stat: PlayerStatPresentation }) {
  const isActive = stat.status === "active";

  return (
    <div className={isActive ? styles.activeRow : styles.placeholderRow}>
      <div>
        <span className={styles.statLabel}>{stat.label}</span>
        <span className={styles.status}>
          {isActive ? "Activa" : "Placeholder · sin efecto"}
        </span>
      </div>
      <strong className={styles.value}>{formatValue(stat)}</strong>
    </div>
  );
}

export function PlayerStatsPanel({ playerState, onClose }: PlayerStatsPanelProps) {
  const activeStats = getActivePlayerStats(playerState.maximumHealth);

  return (
    <div className={styles.overlay}>
      <section
        aria-labelledby="player-stats-title"
        className={styles.panel}
        role="dialog"
      >
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Personaje · Base</p>
            <h2 id="player-stats-title">Stats del jugador</h2>
          </div>
          <button aria-label="Cerrar stats del jugador" className={styles.close} onClick={onClose} type="button">
            ×
          </button>
        </header>

        <section className={styles.activeSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Stats activas</h3>
              <p>Estos valores afectan al juego ahora.</p>
            </div>
            <span className={styles.activeBadge}>En uso</span>
          </div>
          <div className={styles.list}>
            {activeStats.map((stat) => (
              <StatRow key={stat.id} stat={stat} />
            ))}
          </div>
        </section>

        <section className={styles.placeholderSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h3>Stats placeholder</h3>
              <p>Reservadas para sistemas que todavía no están implementados.</p>
            </div>
            <span className={styles.placeholderBadge}>Sin efecto</span>
          </div>

          <div className={styles.categories}>
            {PLAYER_PLACEHOLDER_STAT_CATEGORIES.map((category) => (
              <section className={styles.category} key={category.id}>
                <h4>{category.label}</h4>
                <div className={styles.list}>
                  {category.stats.map((stat) => (
                    <StatRow key={stat.id} stat={stat} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
