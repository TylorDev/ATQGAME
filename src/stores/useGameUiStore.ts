import { adjustCameraDistance, type CameraSettings } from "../game/camera";
import type { ActiveEffect, PlayerCombatSettings } from "../game/types";
import type { ConsoleWindowState } from "../game/consoleWindow";
import {
  createGameLogStore,
  type GameLogStore,
} from "../game/gameLog";
import type { GameUiSnapshot } from "../game/core/GameSnapshot";
import type { GraphicsQualitySettings } from "../game/graphicsQuality";
import { normalizePlayerName } from "../game/playerIdentity";
import type { PlayerDebugStats } from "../game/playerStats";
import type { PlayerHudState, TestDummySnapshot } from "../game/types";

export interface GameUiRuntimeState {
  readonly playerHud: Readonly<PlayerHudState>;
  readonly target: Readonly<TestDummySnapshot> | null;
  readonly debug: Readonly<PlayerDebugStats>;
}

export interface GameUiVisibilityState {
  readonly hud: boolean;
  readonly debug: boolean;
  readonly stats: boolean;
  readonly settings: boolean;
}

export interface GameUiPreferencesState {
  readonly camera: Readonly<CameraSettings>;
  readonly combat: Readonly<PlayerCombatSettings>;
  readonly playerName: string;
  readonly graphics: Readonly<GraphicsQualitySettings>;
  readonly fpsVisible: boolean;
}

export interface GameUiState {
  readonly runtime: GameUiRuntimeState;
  readonly visibility: GameUiVisibilityState;
  readonly preferences: GameUiPreferencesState;
  readonly consoleWindow: Readonly<ConsoleWindowState>;
  readonly framesPerSecond: number | null;
}

export interface CreateGameUiStoreOptions {
  readonly runtime: GameUiRuntimeState;
  readonly camera: CameraSettings;
  readonly combat: PlayerCombatSettings;
  readonly playerName: string;
  readonly graphics: GraphicsQualitySettings;
  readonly fpsVisible: boolean;
  readonly consoleWindow: ConsoleWindowState;
  readonly gameLog?: GameLogStore;
}

type Listener = () => void;

function equalEffects(
  left: readonly ActiveEffect[],
  right: readonly ActiveEffect[],
): boolean {
  return left.length === right.length && left.every((effect, index) => {
    const candidate = right[index];
    return effect.id === candidate.id &&
      effect.kind === candidate.kind &&
      effect.name === candidate.name &&
      effect.description === candidate.description &&
      effect.timerProgress === candidate.timerProgress;
  });
}

function equalPlayerHud(left: Readonly<PlayerHudState>, right: PlayerHudState): boolean {
  return left.currentHealth === right.currentHealth &&
    left.maximumHealth === right.maximumHealth &&
    left.defensePercent === right.defensePercent &&
    left.isDeathNoticeVisible === right.isDeathNoticeVisible &&
    equalEffects(left.activeEffects, right.activeEffects);
}

function equalTarget(
  left: Readonly<TestDummySnapshot> | null,
  right: TestDummySnapshot | null,
): boolean {
  if (left === null || right === null) {
    return left === right;
  }

  return left.id === right.id &&
    left.currentHealth === right.currentHealth &&
    left.maximumHealth === right.maximumHealth &&
    left.lastDamageReceived === right.lastDamageReceived &&
    left.totalDamageReceived === right.totalDamageReceived &&
    left.damagePerSecond === right.damagePerSecond &&
    left.isDefeated === right.isDefeated &&
    left.respawnRemainingSeconds === right.respawnRemainingSeconds;
}

function equalDebug(left: Readonly<PlayerDebugStats>, right: PlayerDebugStats): boolean {
  return left.speedMetersPerSecond === right.speedMetersPerSecond &&
    left.isActive === right.isActive &&
    left.durationRemainingMs === right.durationRemainingMs &&
    left.cooldownRemainingMs === right.cooldownRemainingMs &&
    left.currentHealth === right.currentHealth &&
    left.maximumHealth === right.maximumHealth &&
    left.defensePercent === right.defensePercent;
}

function freezePlayerHud(source: PlayerHudState): Readonly<PlayerHudState> {
  const activeEffects = source.activeEffects.map((effect) => Object.freeze({ ...effect }));
  return Object.freeze({ ...source, activeEffects: Object.freeze(activeEffects) });
}

function freezeTarget(source: TestDummySnapshot | null): Readonly<TestDummySnapshot> | null {
  return source ? Object.freeze({ ...source }) : null;
}

function freezeDebug(source: PlayerDebugStats): Readonly<PlayerDebugStats> {
  return Object.freeze({ ...source });
}

export class GameUiStore {
  readonly gameLog: GameLogStore;
  private readonly listeners = new Set<Listener>();
  private snapshot: GameUiState;

  constructor(options: CreateGameUiStoreOptions) {
    this.gameLog = options.gameLog ?? createGameLogStore();
    this.snapshot = Object.freeze({
      runtime: Object.freeze({
        playerHud: freezePlayerHud(options.runtime.playerHud as PlayerHudState),
        target: freezeTarget(options.runtime.target as TestDummySnapshot | null),
        debug: freezeDebug(options.runtime.debug as PlayerDebugStats),
      }),
      visibility: Object.freeze({ hud: true, debug: false, stats: false, settings: false }),
      preferences: Object.freeze({
        camera: Object.freeze({ ...options.camera }),
        combat: Object.freeze({ ...options.combat }),
        playerName: options.playerName,
        graphics: Object.freeze({ ...options.graphics }),
        fpsVisible: options.fpsVisible,
      }),
      consoleWindow: Object.freeze({ ...options.consoleWindow }),
      framesPerSecond: null,
    });
  }

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): GameUiState => this.snapshot;

  readonly isGameplayBlocked = (): boolean => {
    const state = this.snapshot;
    return state.visibility.stats || state.visibility.settings || state.consoleWindow.isOpen;
  };

  readonly publishRuntime = (snapshot: GameUiSnapshot): void => {
    const current = this.snapshot.runtime;
    const target = snapshot.targetSelected ? snapshot.testDummy : null;
    const playerHud = equalPlayerHud(current.playerHud, snapshot.playerHud)
      ? current.playerHud
      : freezePlayerHud(snapshot.playerHud);
    const nextTarget = equalTarget(current.target, target)
      ? current.target
      : freezeTarget(target);
    const debug = equalDebug(current.debug, snapshot.debug)
      ? current.debug
      : freezeDebug(snapshot.debug);

    if (playerHud === current.playerHud && nextTarget === current.target && debug === current.debug) {
      return;
    }

    this.replace({
      ...this.snapshot,
      runtime: Object.freeze({ playerHud, target: nextTarget, debug }),
    });
  };

  readonly setDebugVisible = (visible: boolean): void => this.updateVisibility({ debug: visible });
  readonly toggleHud = (): void => this.updateVisibility({ hud: !this.snapshot.visibility.hud });
  readonly hideHud = (): void => this.updateVisibility({ hud: false });
  readonly toggleStats = (): void => this.updateVisibility({
    stats: !this.snapshot.visibility.stats,
    settings: false,
  });
  readonly closeStats = (): void => this.updateVisibility({ stats: false });
  readonly toggleSettings = (): void => this.updateVisibility({
    settings: !this.snapshot.visibility.settings,
    stats: false,
  });
  readonly closeSettings = (): void => this.updateVisibility({ settings: false });

  readonly closeOverlays = (): void => {
    this.updateState({
      visibility: Object.freeze({
        ...this.snapshot.visibility,
        stats: false,
        settings: false,
      }),
      consoleWindow: Object.freeze({ ...this.snapshot.consoleWindow, isOpen: false }),
    });
  };

  readonly toggleConsole = (): void => this.setConsoleWindow({
    ...this.snapshot.consoleWindow,
    isOpen: !this.snapshot.consoleWindow.isOpen,
  });

  readonly closeConsole = (): void => this.setConsoleWindow({
    ...this.snapshot.consoleWindow,
    isOpen: false,
  });

  readonly setConsoleWindow = (windowState: ConsoleWindowState): void => {
    const current = this.snapshot.consoleWindow;
    if (current.x === windowState.x && current.y === windowState.y &&
        current.width === windowState.width && current.height === windowState.height &&
        current.isOpen === windowState.isOpen) {
      return;
    }
    this.replace({ ...this.snapshot, consoleWindow: Object.freeze({ ...windowState }) });
  };

  readonly setCamera = (camera: CameraSettings): void => this.updatePreferences({
    camera: Object.freeze({ ...camera }),
  });

  readonly adjustCameraDistance = (deltaMeters: number): void => {
    this.setCamera(adjustCameraDistance(this.snapshot.preferences.camera, deltaMeters));
  };

  readonly setCombat = (combat: PlayerCombatSettings): void => this.updatePreferences({
    combat: Object.freeze({ ...combat }),
  });

  readonly setPlayerName = (playerName: string): void => this.updatePreferences({
    playerName: normalizePlayerName(playerName, this.snapshot.preferences.playerName),
  });

  readonly setGraphics = (graphics: GraphicsQualitySettings): void => this.updatePreferences({
    graphics: Object.freeze({ ...graphics }),
  });

  readonly setFpsVisible = (fpsVisible: boolean): void => this.updatePreferences({ fpsVisible });
  readonly toggleFps = (): void => this.setFpsVisible(!this.snapshot.preferences.fpsVisible);

  readonly setFramesPerSecond = (framesPerSecond: number | null): void => {
    if (this.snapshot.framesPerSecond === framesPerSecond) return;
    this.replace({ ...this.snapshot, framesPerSecond });
  };

  private updateVisibility(patch: Partial<GameUiVisibilityState>): void {
    const current = this.snapshot.visibility;
    const next = Object.freeze({ ...current, ...patch });
    if (current.hud === next.hud && current.debug === next.debug &&
        current.stats === next.stats && current.settings === next.settings) return;
    this.replace({ ...this.snapshot, visibility: next });
  }

  private updatePreferences(patch: Partial<GameUiPreferencesState>): void {
    this.replace({
      ...this.snapshot,
      preferences: Object.freeze({ ...this.snapshot.preferences, ...patch }),
    });
  }

  private updateState(patch: Partial<GameUiState>): void {
    const next = { ...this.snapshot, ...patch };
    if (next.visibility === this.snapshot.visibility && next.consoleWindow === this.snapshot.consoleWindow) return;
    this.replace(next);
  }

  private replace(snapshot: GameUiState): void {
    this.snapshot = Object.freeze(snapshot);
    for (const listener of this.listeners) listener();
  }
}

export function createGameUiStore(options: CreateGameUiStoreOptions): GameUiStore {
  return new GameUiStore(options);
}
