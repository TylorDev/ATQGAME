import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PLAYER_COMBAT_SETTINGS } from "../game/combat";
import { getDefaultCameraSettings } from "../game/camera";
import { getDefaultConsoleWindowState } from "../game/consoleWindow";
import { getDefaultGraphicsQualitySettings } from "../game/graphicsQuality";
import { DEFAULT_PLAYER_DEBUG_STATS, DEFAULT_PLAYER_HUD_STATE } from "../game/playerStats";
import { createGameUiStore } from "./useGameUiStore";
import type { GameUiSnapshot } from "../game/core/GameSnapshot";
import type { ActiveEffect } from "../game/types";

function createStore() {
  return createGameUiStore({
    runtime: {
      playerHud: DEFAULT_PLAYER_HUD_STATE,
      target: null,
      debug: DEFAULT_PLAYER_DEBUG_STATS,
    },
    camera: getDefaultCameraSettings(),
    combat: DEFAULT_PLAYER_COMBAT_SETTINGS,
    playerName: "Jugador",
    graphics: getDefaultGraphicsQualitySettings(),
    fpsVisible: true,
    consoleWindow: { ...getDefaultConsoleWindowState({ width: 1280, height: 720 }), isOpen: false },
  });
}

function runtimeSnapshot(
  selected: boolean,
  activeEffects: readonly ActiveEffect[] = [],
): GameUiSnapshot {
  return {
    playerHud: {
      ...DEFAULT_PLAYER_HUD_STATE,
      activeEffects,
    },
    testDummy: {
      id: "dummy",
      currentHealth: 90,
      maximumHealth: 100,
      lastDamageReceived: 10,
      totalDamageReceived: 10,
      damagePerSecond: 10,
      isDefeated: false,
      respawnRemainingSeconds: 0,
    },
    debug: { ...DEFAULT_PLAYER_DEBUG_STATS },
    targetSelected: selected,
  };
}

describe("GameUiStore", () => {
  it("preserves unrelated runtime slice identities when target changes", () => {
    const store = createStore();
    const before = store.getSnapshot().runtime;
    store.publishRuntime(runtimeSnapshot(true));
    const selected = store.getSnapshot().runtime;

    expect(selected.playerHud).toBe(before.playerHud);
    expect(selected.debug).toBe(before.debug);
    expect(selected.target).not.toBeNull();

    store.publishRuntime(runtimeSnapshot(false));
    const deselected = store.getSnapshot().runtime;
    expect(deselected.playerHud).toBe(selected.playerHud);
    expect(deselected.debug).toBe(selected.debug);
    expect(deselected.target).toBeNull();
  });

  it("does not publish when a runtime projection is structurally unchanged", () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.publishRuntime(runtimeSnapshot(false));
    expect(listener).not.toHaveBeenCalled();
  });

  it("keeps stats and settings mutually exclusive and closes all overlays", () => {
    const store = createStore();
    store.toggleStats();
    expect(store.getSnapshot().visibility).toMatchObject({ stats: true, settings: false });
    expect(store.isGameplayBlocked()).toBe(true);

    store.toggleSettings();
    expect(store.getSnapshot().visibility).toMatchObject({ stats: false, settings: true });
    store.toggleConsole();
    expect(store.getSnapshot().visibility.settings).toBe(true);
    expect(store.getSnapshot().consoleWindow.isOpen).toBe(true);
    store.closeOverlays();
    expect(store.getSnapshot().visibility).toMatchObject({ stats: false, settings: false });
    expect(store.getSnapshot().consoleWindow.isOpen).toBe(false);
    expect(store.isGameplayBlocked()).toBe(false);
  });

  it("updates session settings and preferences through explicit actions", () => {
    const store = createStore();
    store.setPlayerName("Ariadna");
    store.setCombat({ maximumHealth: 2_000, defensePercent: 25 });
    store.setGraphics({ preset: "high", adaptiveDpr: false });
    store.setCamera({ distance: 10, pitchDegrees: 35 });
    store.setFpsVisible(false);
    store.setFramesPerSecond(144);

    expect(store.getSnapshot()).toMatchObject({
      preferences: {
        playerName: "Ariadna",
        combat: { maximumHealth: 2_000, defensePercent: 25 },
        graphics: { preset: "high", adaptiveDpr: false },
        camera: { distance: 10, pitchDegrees: 35 },
        fpsVisible: false,
      },
      framesPerSecond: 144,
    });
  });

  it("owns the log store without copying log entries into its snapshot", () => {
    const store = createStore();
    const uiListener = vi.fn();
    const logListener = vi.fn();
    store.subscribe(uiListener);
    store.gameLog.subscribe(logListener);
    store.gameLog.publishDamage({
      occurredAtMs: 1,
      appliedDamage: 10,
      receiver: { id: "dummy", kind: "test-dummy", displayName: "Dummy" },
      source: { id: "player", kind: "player", displayName: "Jugador" },
    });

    expect(logListener).toHaveBeenCalledOnce();
    expect(uiListener).not.toHaveBeenCalled();
    expect("gameLog" in store.getSnapshot()).toBe(false);
  });

  it("freezes published UI projections and keeps preferences structurally shared", () => {
    const store = createStore();
    const runtime = runtimeSnapshot(true, [{
      id: "burning", kind: "debuff", name: "Ardiendo", description: "Daño", timerProgress: 1,
    }]);
    store.publishRuntime(runtime);
    const state = store.getSnapshot();
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.runtime.playerHud)).toBe(true);
    expect(Object.isFrozen(state.runtime.playerHud.activeEffects)).toBe(true);
    expect(Object.isFrozen(state.runtime.target)).toBe(true);
    const runtimeIdentity = state.runtime;
    store.setFpsVisible(false);
    expect(store.getSnapshot().runtime).toBe(runtimeIdentity);
  });
});
