import { describe, expect, it } from "vitest";
import { UiPublishGate } from "./uiPublishGate";

describe("UiPublishGate", () => {
  it("limits continuous updates to ten per second", () => {
    const gate = new UiPublishGate(100);
    let publications = 0;

    for (let timestampMs = 0; timestampMs < 1_000; timestampMs += 10) {
      publications += gate.shouldPublish(timestampMs, false) ? 1 : 0;
    }

    expect(publications).toBe(10);
  });

  it("allows critical transitions immediately and restarts the interval", () => {
    const gate = new UiPublishGate(100);
    expect(gate.shouldPublish(0, false)).toBe(true);
    expect(gate.shouldPublish(20, false)).toBe(false);
    expect(gate.shouldPublish(20, true)).toBe(true);
    expect(gate.shouldPublish(100, false)).toBe(false);
    expect(gate.shouldPublish(120, false)).toBe(true);
  });
});
