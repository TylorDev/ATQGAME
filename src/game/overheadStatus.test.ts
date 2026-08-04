import { describe, expect, it } from "vitest";
import {
  formatHealthSignalValue,
  getEffectTimerProgress,
  getHealthFillRatio,
  getHealthSignalColor,
} from "./overheadStatus";

describe("overhead status", () => {
  it("keeps the exact health ratio without segment quantization", () => {
    expect(getHealthFillRatio(1_000, 1_000)).toBe(1);
    expect(getHealthFillRatio(937, 1_000)).toBe(0.937);
    expect(getHealthFillRatio(901, 1_000)).toBe(0.901);
    expect(getHealthFillRatio(655, 1_000)).toBe(0.655);
    expect(getHealthFillRatio(1, 1_000)).toBe(0.001);
    expect(getHealthFillRatio(0, 1_000)).toBe(0);
  });

  it("uses the current maximum health and clamps invalid values", () => {
    expect(getHealthFillRatio(250, 500)).toBe(0.5);
    expect(getHealthFillRatio(2_000, 1_000)).toBe(1);
    expect(getHealthFillRatio(-1, 1_000)).toBe(0);
    expect(getHealthFillRatio(500, 0)).toBe(0);
  });

  it("normalizes finite effect timers into circular progress", () => {
    expect(getEffectTimerProgress(5_000, 5_000)).toBe(1);
    expect(getEffectTimerProgress(2_500, 5_000)).toBe(0.5);
    expect(getEffectTimerProgress(0, 5_000)).toBe(0);
    expect(getEffectTimerProgress(8_000, 5_000)).toBe(1);
  });

  it("formats signed whole health changes and reserves zero for no change", () => {
    expect(formatHealthSignalValue(-120)).toBe("-120");
    expect(formatHealthSignalValue(120)).toBe("+120");
    expect(formatHealthSignalValue(0)).toBe("0");
    expect(formatHealthSignalValue(-0.1)).toBe("-1");
    expect(formatHealthSignalValue(0.1)).toBe("+1");
    expect(formatHealthSignalValue(Number.NaN)).toBe("0");
  });

  it("maps health changes to damage, recovery and zero colors", () => {
    expect(getHealthSignalColor(-1)).toBe("#f05f57");
    expect(getHealthSignalColor(1)).toBe("#74d641");
    expect(getHealthSignalColor(0)).toBe("#ffffff");
  });
});
