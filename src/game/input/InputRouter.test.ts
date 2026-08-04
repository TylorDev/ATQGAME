import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  getAppInputContext,
  InputRouter,
  resolveKeyboardInput,
  type AppInputAction,
} from "./InputRouter";

function keyboard(
  code: string,
  options: { repeat?: boolean; editable?: boolean } = {},
) {
  return {
    code,
    repeat: options.repeat ?? false,
    target: options.editable ? ({ tagName: "INPUT" } as unknown as EventTarget) : null,
  };
}

describe("InputRouter", () => {
  it("resolves the fixed keyboard map to semantic actions", () => {
    expect(resolveKeyboardInput(keyboard("F10"))).toEqual({ type: "toggle-console" });
    expect(resolveKeyboardInput(keyboard("Escape"))).toEqual({ type: "close-overlays" });
    expect(resolveKeyboardInput(keyboard("KeyI"))).toEqual({ type: "toggle-player-stats" });
    expect(resolveKeyboardInput(keyboard("KeyH"))).toEqual({ type: "toggle-player-hud" });
    expect(resolveKeyboardInput(keyboard("KeyF"))).toEqual({ type: "activate-speed-boost" });
    expect(resolveKeyboardInput(keyboard("KeyQ"))).toEqual({ type: "toggle-player-area" });
  });

  it("keeps F10 and Escape global while editing and ignores other shortcuts", () => {
    expect(resolveKeyboardInput(keyboard("F10", { editable: true }))).toEqual({ type: "toggle-console" });
    expect(resolveKeyboardInput(keyboard("Escape", { editable: true }))).toEqual({ type: "close-overlays" });
    expect(resolveKeyboardInput(keyboard("KeyF", { editable: true }))).toBeNull();
    expect(resolveKeyboardInput(keyboard("KeyI", { editable: true }))).toBeNull();
    expect(resolveKeyboardInput(keyboard("F10", { repeat: true }))).toBeNull();
  });

  it("blocks gameplay without blocking global or UI contexts", () => {
    const listener = vi.fn(() => true);
    const router = new InputRouter(() => true);
    router.subscribe("global", listener);
    router.subscribe("ui", listener);
    router.subscribe("gameplay", listener);

    expect(router.dispatch({ type: "activate-speed-boost" })).toBe(false);
    expect(router.dispatch({ type: "toggle-player-hud" })).toBe(true);
    expect(router.dispatch({ type: "close-overlays" })).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("reports consumption only when a registered listener handles the action", () => {
    const router = new InputRouter(() => false);
    expect(router.dispatchKeyboard(keyboard("KeyF"))).toBe(false);
    const unsubscribe = router.subscribe("gameplay", () => true);
    expect(router.dispatchKeyboard(keyboard("KeyF"))).toBe(true);
    unsubscribe();
    expect(router.dispatchKeyboard(keyboard("KeyF"))).toBe(false);
  });

  it("assigns every semantic action to its declared context", () => {
    const cases: readonly [AppInputAction, string][] = [
      [{ type: "cancel-gameplay" }, "global"],
      [{ type: "toggle-console" }, "global"],
      [{ type: "toggle-player-stats" }, "ui"],
      [{ type: "toggle-player-hud" }, "ui"],
      [{ type: "camera-zoom", deltaMeters: 2 }, "gameplay"],
      [{ type: "activate-target", targetId: "dummy" }, "gameplay"],
    ];
    for (const [action, context] of cases) expect(getAppInputContext(action)).toBe(context);
  });

  it("keeps the root adapter as the only keyboard listener owner", () => {
    const rootAdapter = readFileSync(
      new URL("../../components/AppInputAdapter/AppInputAdapter.tsx", import.meta.url),
      "utf8",
    );
    const formerOwners = [
      "../../pages/Home/Home.tsx",
      "../../components/GameConsole/GameConsole.tsx",
      "../../components/BrowserGameInput/BrowserGameInput.tsx",
    ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));

    expect(rootAdapter.match(/addEventListener\("keydown"/g)).toHaveLength(1);
    for (const source of formerOwners) {
      expect(source).not.toContain('addEventListener("keydown"');
    }
  });
});
