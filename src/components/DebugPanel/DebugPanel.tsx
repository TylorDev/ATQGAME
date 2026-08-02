import * as Checkbox from "@radix-ui/react-checkbox";
import * as Slider from "@radix-ui/react-slider";
import {
  CAMERA_DISTANCE_MAX,
  CAMERA_DISTANCE_MIN,
  CAMERA_DISTANCE_STEP,
  CAMERA_PITCH_MAX,
  CAMERA_PITCH_MIN,
  CAMERA_PITCH_STEP,
  type CameraSettings,
} from "@/game/camera";
import {
  PLAYER_DEFENSE_PERCENT_MAX,
  PLAYER_DEFENSE_PERCENT_MIN,
  PLAYER_DEFENSE_PERCENT_STEP,
  PLAYER_MAXIMUM_HEALTH_MAX,
  PLAYER_MAXIMUM_HEALTH_MIN,
  PLAYER_MAXIMUM_HEALTH_STEP,
} from "@/game/combat";
import type { PlayerDebugStats } from "@/game/playerStats";
import type { PlayerCombatSettings } from "@/game/types";
import styles from "./DebugPanel.module.scss";

interface DebugPanelProps {
  enabled: boolean;
  settings: CameraSettings;
  playerStats: PlayerDebugStats;
  combatSettings: PlayerCombatSettings;
  onEnabledChange: (enabled: boolean) => void;
  onSettingsChange: (settings: CameraSettings) => void;
  onCombatSettingsChange: (settings: PlayerCombatSettings) => void;
}

interface SliderFieldProps {
  label: string;
  value: number;
  formattedValue: string;
  minimum: number;
  maximum: number;
  step: number;
  onChange: (value: number) => void;
}

function SliderField({
  label,
  value,
  formattedValue,
  minimum,
  maximum,
  step,
  onChange,
}: SliderFieldProps) {
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <output className={styles.value}>{formattedValue}</output>
      </div>
      <Slider.Root
        className={styles.slider}
        value={[value]}
        min={minimum}
        max={maximum}
        step={step}
        onValueChange={([nextValue]) => {
          if (nextValue !== undefined) {
            onChange(nextValue);
          }
        }}
      >
        <Slider.Track className={styles.track}>
          <Slider.Range className={styles.range} />
        </Slider.Track>
        <Slider.Thumb className={styles.thumb} aria-label={label} />
      </Slider.Root>
    </div>
  );
}

function formatSeconds(durationMs: number): string {
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function PlayerStats({ stats }: { stats: PlayerDebugStats }) {
  const buffStatus = stats.isActive
    ? `Activo · ${formatSeconds(stats.durationRemainingMs)}`
    : stats.cooldownRemainingMs > 0
      ? "En espera"
      : "Listo";
  const cooldownStatus =
    stats.cooldownRemainingMs > 0
      ? formatSeconds(stats.cooldownRemainingMs)
      : "Listo";

  return (
    <section className={styles.stats} aria-label="Estadísticas del jugador">
      <span className={styles.statsHeading}>Jugador</span>
      <dl className={styles.statList}>
        <div className={styles.statRow}>
          <dt className={styles.statLabel}>Vida</dt>
          <dd className={styles.statValue}>
            {stats.currentHealth.toFixed(0)} / {stats.maximumHealth.toFixed(0)} HP
          </dd>
        </div>
        <div className={styles.statRow}>
          <dt className={styles.statLabel}>Defensa</dt>
          <dd className={styles.statValue}>{stats.defensePercent.toFixed(0)}%</dd>
        </div>
        <div className={styles.statRow}>
          <dt className={styles.statLabel}>Velocidad actual</dt>
          <dd className={styles.statValue}>
            {stats.speedMetersPerSecond.toFixed(2)} m/s
          </dd>
        </div>
        <div className={styles.statRow}>
          <dt className={styles.statLabel}>Buff F</dt>
          <dd className={styles.statValue}>{buffStatus}</dd>
        </div>
        <div className={styles.statRow}>
          <dt className={styles.statLabel}>Cooldown F</dt>
          <dd className={styles.statValue}>{cooldownStatus}</dd>
        </div>
      </dl>
    </section>
  );
}

export function DebugPanel({
  enabled,
  settings,
  playerStats,
  combatSettings,
  onEnabledChange,
  onSettingsChange,
  onCombatSettingsChange,
}: DebugPanelProps) {
  return (
    <aside className={styles.panel} aria-label="Calibración y combate">
      <div className={styles.header}>
        <div>
          <span className={styles.badge}>DEV</span>
          <span className={styles.heading}>Modo debug</span>
        </div>
        <label className={styles.toggleLabel} htmlFor="debug-mode">
          <span className={styles.toggleText}>{enabled ? "Activo" : "Inactivo"}</span>
          <Checkbox.Root
            id="debug-mode"
            className={styles.checkbox}
            checked={enabled}
            onCheckedChange={(checked) => onEnabledChange(checked === true)}
          >
            <Checkbox.Indicator className={styles.indicator}>✓</Checkbox.Indicator>
          </Checkbox.Root>
        </label>
      </div>

      {enabled ? (
        <div className={styles.controls}>
          <div className={styles.rule} />
          <PlayerStats stats={playerStats} />
          <section className={styles.combat} aria-label="Ajustes de combate">
            <span className={styles.combatHeading}>Combate</span>
            <SliderField
              label="Vida máxima"
              value={combatSettings.maximumHealth}
              formattedValue={`${combatSettings.maximumHealth.toFixed(0)} HP`}
              minimum={PLAYER_MAXIMUM_HEALTH_MIN}
              maximum={PLAYER_MAXIMUM_HEALTH_MAX}
              step={PLAYER_MAXIMUM_HEALTH_STEP}
              onChange={(maximumHealth) =>
                onCombatSettingsChange({ ...combatSettings, maximumHealth })
              }
            />
            <SliderField
              label="Defensa"
              value={combatSettings.defensePercent}
              formattedValue={`${combatSettings.defensePercent.toFixed(0)}%`}
              minimum={PLAYER_DEFENSE_PERCENT_MIN}
              maximum={PLAYER_DEFENSE_PERCENT_MAX}
              step={PLAYER_DEFENSE_PERCENT_STEP}
              onChange={(defensePercent) =>
                onCombatSettingsChange({ ...combatSettings, defensePercent })
              }
            />
          </section>
          <SliderField
            label="Distancia"
            value={settings.distance}
            formattedValue={`${settings.distance.toFixed(1)} m`}
            minimum={CAMERA_DISTANCE_MIN}
            maximum={CAMERA_DISTANCE_MAX}
            step={CAMERA_DISTANCE_STEP}
            onChange={(distance) =>
              onSettingsChange({ ...settings, distance })
            }
          />
          <SliderField
            label="Inclinación"
            value={settings.pitchDegrees}
            formattedValue={`${settings.pitchDegrees.toFixed(0)}°`}
            minimum={CAMERA_PITCH_MIN}
            maximum={CAMERA_PITCH_MAX}
            step={CAMERA_PITCH_STEP}
            onChange={(pitchDegrees) =>
              onSettingsChange({ ...settings, pitchDegrees })
            }
          />
          <p className={styles.note}>La trayectoria muestra el destino pendiente.</p>
        </div>
      ) : null}
    </aside>
  );
}
