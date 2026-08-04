import { HUD_KEYBINDINGS } from "@/game/keybindings";
import type { PlayerHudState, TestDummySnapshot } from "@/game/types";
import styles from "./PlayerHud.module.scss";

interface PlayerHudProps {
  state: PlayerHudState;
  testDummy: TestDummySnapshot | null;
  blurEnabled: boolean;
}

function formatHealth(health: number): string {
  return Math.round(health).toLocaleString("es-ES");
}

export function PlayerHud({ state, testDummy, blurEnabled }: PlayerHudProps) {
  const healthPercent =
    state.maximumHealth > 0
      ? Math.min((state.currentHealth / state.maximumHealth) * 100, 100)
      : 0;
  const dummyHealthPercent = testDummy
    ? Math.min(
        (testDummy.currentHealth / testDummy.maximumHealth) * 100,
        100,
      )
    : 0;

  return (
    <>
      <aside
        className={`${styles.hud} ${blurEnabled ? styles.blurred : styles.solid}`}
        aria-label="Estado del jugador"
      >
        <div className={styles.eyebrow}>Arena / Prueba 01</div>
        <p className={styles.title}>Jugador</p>

        <div className={styles.healthHeader}>
          <span>Integridad</span>
          <output>
            {formatHealth(state.currentHealth)} / {formatHealth(state.maximumHealth)} HP
          </output>
        </div>
        <div
          className={styles.healthTrack}
          role="progressbar"
          aria-label="Vida del jugador"
          aria-valuemin={0}
          aria-valuemax={state.maximumHealth}
          aria-valuenow={state.currentHealth}
        >
          <div className={styles.healthFill} style={{ width: `${healthPercent}%` }} />
        </div>

        <div className={styles.rule} />
        <section className={styles.effects} aria-labelledby="effects-heading">
          <div className={styles.effectsHeader}>
            <span id="effects-heading">Efectos</span>
            <span>{state.activeEffects.length}</span>
          </div>
          {state.activeEffects.length === 0 ? (
            <p className={styles.empty}>Sin efectos activos.</p>
          ) : (
            <div className={styles.effectList}>
              {state.activeEffects.map((effect) => (
                <article className={styles.effect} key={effect.id}>
                  <span
                    className={
                      effect.kind === "buff" ? styles.buff : styles.debuff
                    }
                  >
                    {effect.kind}
                  </span>
                  <div className={styles.effectCopy}>
                    <p className={styles.effectName}>{effect.name}</p>
                    <p className={styles.effectDescription}>{effect.description}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {testDummy ? (
          <>
            <div className={styles.rule} />
            <section className={styles.target} aria-labelledby="target-heading">
              <div className={styles.targetHeader}>
                <span id="target-heading">Objetivo</span>
                <span>Muñeco de pruebas</span>
              </div>
              <div className={styles.healthHeader}>
                <span>Integridad</span>
                <output>
                  {formatHealth(testDummy.currentHealth)} / {formatHealth(testDummy.maximumHealth)} HP
                </output>
              </div>
              <div
                className={styles.targetHealthTrack}
                role="progressbar"
                aria-label="Vida del muñeco de pruebas"
                aria-valuemin={0}
                aria-valuemax={testDummy.maximumHealth}
                aria-valuenow={testDummy.currentHealth}
              >
                <div
                  className={styles.targetHealthFill}
                  style={{ width: `${dummyHealthPercent}%` }}
                />
              </div>
              {testDummy.isDefeated ? (
                <p className={styles.targetStatus}>
                  Derrotado · reaparece en {testDummy.respawnRemainingSeconds.toFixed(1)} s
                </p>
              ) : null}
              <dl className={styles.targetStats}>
                <div>
                  <dt>Daño recibido</dt>
                  <dd>{formatHealth(testDummy.lastDamageReceived)}</dd>
                </div>
                <div>
                  <dt>DPS</dt>
                  <dd>{testDummy.damagePerSecond.toFixed(1)}</dd>
                </div>
                <div>
                  <dt>Daño total</dt>
                  <dd>{formatHealth(testDummy.totalDamageReceived)}</dd>
                </div>
              </dl>
            </section>
          </>
        ) : null}

        <div className={styles.rule} />
        {HUD_KEYBINDINGS.map((binding) => (
          <p className={styles.instruction} key={binding.id}>
            <span className={styles.input}>{binding.input}</span>
            <span>{binding.description}</span>
          </p>
        ))}
      </aside>

      {state.isDeathNoticeVisible ? (
        <div className={styles.deathNotice} role="status" aria-live="polite">
          Jugador ha muerto
        </div>
      ) : null}
    </>
  );
}
