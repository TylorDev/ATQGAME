import { describe, expect, it } from "vitest";
import {
  CLOSE_OVERLAYS_KEYBINDING,
  GAME_KEYBINDINGS,
  PLAYER_STATS_KEYBINDING,
} from "./keybindings";

describe("game keybindings", () => {
  it("defines every available input once with a description", () => {
    const ids = GAME_KEYBINDINGS.map((binding) => binding.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(GAME_KEYBINDINGS).toHaveLength(6);
    expect(GAME_KEYBINDINGS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: "LMB" }),
        expect.objectContaining({ input: "RMB" }),
        expect.objectContaining({ input: "F", code: "KeyF" }),
        expect.objectContaining({ input: "Rueda" }),
        expect.objectContaining({ input: "I", code: "KeyI" }),
        expect.objectContaining({ input: "Esc", code: "Escape" }),
      ]),
    );
    expect(GAME_KEYBINDINGS.every((binding) => binding.description.length > 0)).toBe(
      true,
    );
  });

  it("exposes the shared overlay keys", () => {
    expect(PLAYER_STATS_KEYBINDING.code).toBe("KeyI");
    expect(CLOSE_OVERLAYS_KEYBINDING.code).toBe("Escape");
  });
});
