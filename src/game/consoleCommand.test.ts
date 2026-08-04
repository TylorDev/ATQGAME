import { describe, expect, it } from "vitest";
import { parseGameConsoleCommand } from "./consoleCommand";

describe("game console commands", () => {
  it("recognizes the FPS toggle with whitespace or uppercase letters", () => {
    expect(parseGameConsoleCommand("/fps")).toEqual({ type: "toggle-fps" });
    expect(parseGameConsoleCommand("  /FPS  ")).toEqual({
      type: "toggle-fps",
    });
  });

  it("ignores empty input", () => {
    expect(parseGameConsoleCommand("   ")).toEqual({ type: "empty" });
  });

  it("preserves unknown input for the error message", () => {
    expect(parseGameConsoleCommand(" /unknown ")).toEqual({
      type: "unknown",
      input: "/unknown",
    });
  });
});
