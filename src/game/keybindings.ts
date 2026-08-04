export interface GameKeybinding {
  id: string;
  input: string;
  code?: string;
  label: string;
  description: string;
}

export const SELECT_TARGET_KEYBINDING: Readonly<GameKeybinding> = {
  id: "select-target",
  input: "LMB",
  label: "Seleccionar objetivo",
  description: "Selecciona o reanuda la persecución del muñeco de pruebas.",
};

export const MOVE_OR_PAUSE_KEYBINDING: Readonly<GameKeybinding> = {
  id: "move-or-pause",
  input: "RMB",
  label: "Mover o pausar",
  description: "En el mapa camina y pausa; sobre el muñeco reanuda la persecución.",
};

export const SPEED_BOOST_KEYBINDING: Readonly<GameKeybinding> = {
  id: "speed-boost",
  input: "F",
  code: "KeyF",
  label: "Impulso",
  description: "Aumenta la velocidad ×1,8 durante 5 s. Cooldown: 15 s.",
};

export const CAMERA_ZOOM_KEYBINDING: Readonly<GameKeybinding> = {
  id: "camera-zoom",
  input: "Rueda",
  label: "Zoom de cámara",
  description: "Acerca o aleja la cámara 2 m por tick.",
};

export const PLAYER_STATS_KEYBINDING: Readonly<GameKeybinding> = {
  id: "player-stats",
  input: "I",
  code: "KeyI",
  label: "Stats del jugador",
  description: "Abre o cierra el panel de estadísticas del personaje.",
};

export const GAME_CONSOLE_KEYBINDING: Readonly<GameKeybinding> = {
  id: "game-console",
  input: "F10",
  code: "F10",
  label: "Consola del mapa",
  description: "Muestra u oculta el registro global de daño del mapa.",
};

export const CLOSE_OVERLAYS_KEYBINDING: Readonly<GameKeybinding> = {
  id: "close-overlays",
  input: "Esc",
  code: "Escape",
  label: "Cerrar paneles",
  description: "Cierra los paneles de Stats y Settings que estén abiertos.",
};

export const HUD_KEYBINDINGS = [
  SELECT_TARGET_KEYBINDING,
  MOVE_OR_PAUSE_KEYBINDING,
  SPEED_BOOST_KEYBINDING,
] as const;

export const GAME_KEYBINDINGS = [
  ...HUD_KEYBINDINGS,
  CAMERA_ZOOM_KEYBINDING,
  PLAYER_STATS_KEYBINDING,
  GAME_CONSOLE_KEYBINDING,
  CLOSE_OVERLAYS_KEYBINDING,
] as const;

export function isEditableEventTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") {
    return false;
  }

  const candidate = target as {
    tagName?: string;
    isContentEditable?: boolean;
  };

  return (
    candidate.isContentEditable === true ||
    candidate.tagName === "INPUT" ||
    candidate.tagName === "TEXTAREA" ||
    candidate.tagName === "SELECT"
  );
}
