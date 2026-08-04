import {
  CLOSE_OVERLAYS_KEYBINDING,
  GAME_CONSOLE_KEYBINDING,
  isEditableEventTarget,
  PLAYER_AREA_KEYBINDING,
  PLAYER_HUD_KEYBINDING,
  PLAYER_STATS_KEYBINDING,
  SPEED_BOOST_KEYBINDING,
} from "../keybindings";
import type { GroundPoint } from "../types";

export type AppInputContext = "global" | "ui" | "gameplay";

export type AppInputAction =
  | { readonly type: "toggle-console" }
  | { readonly type: "close-overlays" }
  | { readonly type: "cancel-gameplay" }
  | { readonly type: "toggle-player-stats" }
  | { readonly type: "toggle-player-hud" }
  | { readonly type: "activate-speed-boost" }
  | { readonly type: "toggle-player-area" }
  | { readonly type: "activate-target"; readonly targetId: string }
  | { readonly type: "start-ground-move"; readonly point: GroundPoint; readonly timestampMs: number }
  | { readonly type: "steer-ground-move"; readonly point: GroundPoint }
  | { readonly type: "finish-ground-move"; readonly timestampMs: number }
  | { readonly type: "camera-zoom"; readonly deltaMeters: number };

export interface KeyboardInputLike {
  readonly code: string;
  readonly repeat: boolean;
  readonly target: EventTarget | null;
}

type InputListener = (action: AppInputAction) => boolean;

export function getAppInputContext(action: AppInputAction): AppInputContext {
  switch (action.type) {
    case "toggle-console":
    case "close-overlays":
    case "cancel-gameplay":
      return "global";
    case "toggle-player-stats":
    case "toggle-player-hud":
      return "ui";
    default:
      return "gameplay";
  }
}

export function resolveKeyboardInput(event: KeyboardInputLike): AppInputAction | null {
  if (event.repeat) return null;

  if (event.code === GAME_CONSOLE_KEYBINDING.code) return { type: "toggle-console" };
  if (event.code === CLOSE_OVERLAYS_KEYBINDING.code) return { type: "close-overlays" };
  if (isEditableEventTarget(event.target)) return null;
  if (event.code === PLAYER_STATS_KEYBINDING.code) return { type: "toggle-player-stats" };
  if (event.code === PLAYER_HUD_KEYBINDING.code) return { type: "toggle-player-hud" };
  if (event.code === SPEED_BOOST_KEYBINDING.code) return { type: "activate-speed-boost" };
  if (event.code === PLAYER_AREA_KEYBINDING.code) return { type: "toggle-player-area" };
  return null;
}

export class InputRouter {
  private readonly listeners: Record<AppInputContext, Set<InputListener>> = {
    global: new Set(),
    ui: new Set(),
    gameplay: new Set(),
  };

  constructor(private readonly isGameplayBlocked: () => boolean) {}

  subscribe(context: AppInputContext, listener: InputListener): () => void {
    this.listeners[context].add(listener);
    return () => this.listeners[context].delete(listener);
  }

  dispatch(action: AppInputAction): boolean {
    const context = getAppInputContext(action);
    if (context === "gameplay" && this.isGameplayBlocked()) return false;
    let consumed = false;
    for (const listener of this.listeners[context]) consumed = listener(action) || consumed;
    return consumed;
  }

  dispatchKeyboard(event: KeyboardInputLike): boolean {
    const action = resolveKeyboardInput(event);
    return action ? this.dispatch(action) : false;
  }
}
