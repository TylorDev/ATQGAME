import { useEffect, useRef } from "react";
import { useGameUiSelector, useGameUiStore } from "@/contexts/GameUiContext";
import { FpsSampler } from "@/game/fpsDisplay";
import styles from "./FpsCounter.module.scss";

export function FpsCounter() {
  const store = useGameUiStore();
  const visible = useGameUiSelector((state) => state.preferences.fpsVisible);
  const framesPerSecond = useGameUiSelector((state) => state.framesPerSecond);
  const outputRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    if (!visible) {
      store.setFramesPerSecond(null);
      return;
    }

    const sampler = new FpsSampler();
    let frameId = 0;

    const recordFrame = (timestampMs: number): void => {
      const framesPerSecond = sampler.recordFrame(timestampMs);

      if (framesPerSecond !== null && outputRef.current) {
        store.setFramesPerSecond(framesPerSecond);
      }

      frameId = window.requestAnimationFrame(recordFrame);
    };
    const resetSample = (): void => {
      sampler.reset();
      store.setFramesPerSecond(null);

      if (outputRef.current) {
        outputRef.current.textContent = "FPS --";
      }
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        resetSample();
      } else {
        sampler.reset();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    frameId = window.requestAnimationFrame(recordFrame);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.cancelAnimationFrame(frameId);
    };
  }, [store, visible]);

  if (!visible) return null;

  return (
    <output
      aria-label="Fotogramas por segundo"
      className={styles.counter}
      ref={outputRef}
    >
      {framesPerSecond === null ? "FPS --" : `FPS ${framesPerSecond}`}
    </output>
  );
}
