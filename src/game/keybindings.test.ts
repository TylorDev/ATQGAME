import { describe, expect, it } from "vitest";
import {
  CLOSE_OVERLAYS_KEYBINDING,
  GAME_CONSOLE_KEYBINDING,
  GAME_KEYBINDINGS,
  isEditableEventTarget,
  PLAYER_STATS_KEYBINDING,
} from "./keybindings";

describe("game keybindings", () => {
  it("defines every available input once with a description", () => {
    const ids = GAME_KEYBINDINGS.map((binding) => binding.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(GAME_KEYBINDINGS).toHaveLength(7);
    expect(GAME_KEYBINDINGS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ input: "LMB" }),
        expect.objectContaining({ input: "RMB" }),
        expect.objectContaining({ input: "F", code: "KeyF" }),
        expect.objectContaining({ input: "Rueda" }),
        expect.objectContaining({ input: "I", code: "KeyI" }),
        expect.objectContaining({ input: "F10", code: "F10" }),
        expect.objectContaining({ input: "Esc", code: "Escape" }),
      ]),
    );
    expect(GAME_KEYBINDINGS.every((binding) => binding.description.length > 0)).toBe(
      true,
    );
  });

  it("exposes the shared overlay keys", () => {
    expect(PLAYER_STATS_KEYBINDING.code).toBe("KeyI");
    expect(GAME_CONSOLE_KEYBINDING.code).toBe("F10");
    expect(CLOSE_OVERLAYS_KEYBINDING.code).toBe("Escape");
  });

  it("detects text-entry targets without depending on browser globals", () => {
    expect(isEditableEventTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(
      true,
    );
    expect(
      isEditableEventTarget({ isContentEditable: true } as unknown as EventTarget),
    ).toBe(true);
    expect(isEditableEventTarget({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(
      false,
    );
  });
});
