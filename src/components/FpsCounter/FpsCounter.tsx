import { useEffect, useRef } from "react";
import { FpsSampler } from "@/game/fpsDisplay";
import styles from "./FpsCounter.module.scss";

export function FpsCounter() {
  const outputRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    const sampler = new FpsSampler();
    let frameId = 0;

    const recordFrame = (timestampMs: number): void => {
      const framesPerSecond = sampler.recordFrame(timestampMs);

      if (framesPerSecond !== null && outputRef.current) {
        outputRef.current.textContent = `FPS ${framesPerSecond}`;
      }

      frameId = window.requestAnimationFrame(recordFrame);
    };
    const resetSample = (): void => {
      sampler.reset();

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
  }, []);

  return (
    <output
      aria-label="Fotogramas por segundo"
      className={styles.counter}
      ref={outputRef}
    >
      FPS --
    </output>
  );
}
