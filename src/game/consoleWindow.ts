export type ConsoleResizeDirection =
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w"
  | "nw";

export interface ConsoleViewport {
  width: number;
  height: number;
}

export interface ConsoleWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isOpen: boolean;
}

interface ConsoleWindowStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredConsoleWindowState extends ConsoleWindowState {
  version: 1;
}

export const CONSOLE_WINDOW_STORAGE_KEY = "arena-rpg.game-console.v1";
export const CONSOLE_WINDOW_MARGIN_PX = 16;
export const CONSOLE_WINDOW_DEFAULT_WIDTH_PX = 560;
export const CONSOLE_WINDOW_DEFAULT_HEIGHT_PX = 260;
export const CONSOLE_WINDOW_MIN_WIDTH_PX = 360;
export const CONSOLE_WINDOW_MIN_HEIGHT_PX = 180;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getBounds(viewport: ConsoleViewport) {
  const width = Math.max(viewport.width, CONSOLE_WINDOW_MARGIN_PX * 2 + 1);
  const height = Math.max(viewport.height, CONSOLE_WINDOW_MARGIN_PX * 2 + 1);
  const availableWidth = width - CONSOLE_WINDOW_MARGIN_PX * 2;
  const availableHeight = height - CONSOLE_WINDOW_MARGIN_PX * 2;

  return {
    minimumX: CONSOLE_WINDOW_MARGIN_PX,
    minimumY: CONSOLE_WINDOW_MARGIN_PX,
    maximumX: width - CONSOLE_WINDOW_MARGIN_PX,
    maximumY: height - CONSOLE_WINDOW_MARGIN_PX,
    availableWidth,
    availableHeight,
    minimumWidth: Math.min(CONSOLE_WINDOW_MIN_WIDTH_PX, availableWidth),
    minimumHeight: Math.min(CONSOLE_WINDOW_MIN_HEIGHT_PX, availableHeight),
  };
}

export function getDefaultConsoleWindowState(
  viewport: ConsoleViewport,
): ConsoleWindowState {
  const bounds = getBounds(viewport);
  const width = Math.min(CONSOLE_WINDOW_DEFAULT_WIDTH_PX, bounds.availableWidth);
  const height = Math.min(CONSOLE_WINDOW_DEFAULT_HEIGHT_PX, bounds.availableHeight);

  return {
    x: bounds.minimumX,
    y: bounds.maximumY - height,
    width,
    height,
    isOpen: true,
  };
}

export function normalizeConsoleWindowState(
  value: unknown,
  viewport: ConsoleViewport,
): ConsoleWindowState {
  const defaults = getDefaultConsoleWindowState(viewport);
  const candidate = value && typeof value === "object"
    ? (value as Partial<ConsoleWindowState>)
    : {};
  const bounds = getBounds(viewport);
  const width = clamp(
    finiteOr(candidate.width, defaults.width),
    bounds.minimumWidth,
    bounds.availableWidth,
  );
  const height = clamp(
    finiteOr(candidate.height, defaults.height),
    bounds.minimumHeight,
    bounds.availableHeight,
  );

  return {
    x: clamp(
      finiteOr(candidate.x, defaults.x),
      bounds.minimumX,
      bounds.maximumX - width,
    ),
    y: clamp(
      finiteOr(candidate.y, defaults.y),
      bounds.minimumY,
      bounds.maximumY - height,
    ),
    width,
    height,
    isOpen: typeof candidate.isOpen === "boolean" ? candidate.isOpen : true,
  };
}

export function moveConsoleWindow(
  initial: ConsoleWindowState,
  deltaX: number,
  deltaY: number,
  viewport: ConsoleViewport,
): ConsoleWindowState {
  return normalizeConsoleWindowState(
    { ...initial, x: initial.x + deltaX, y: initial.y + deltaY },
    viewport,
  );
}

export function resizeConsoleWindow(
  initial: ConsoleWindowState,
  direction: ConsoleResizeDirection,
  deltaX: number,
  deltaY: number,
  viewport: ConsoleViewport,
): ConsoleWindowState {
  const normalized = normalizeConsoleWindowState(initial, viewport);
  const bounds = getBounds(viewport);
  let left = normalized.x;
  let right = normalized.x + normalized.width;
  let top = normalized.y;
  let bottom = normalized.y + normalized.height;

  if (direction.includes("e")) {
    right = clamp(
      right + deltaX,
      left + bounds.minimumWidth,
      bounds.maximumX,
    );
  }

  if (direction.includes("w")) {
    left = clamp(
      left + deltaX,
      bounds.minimumX,
      right - bounds.minimumWidth,
    );
  }

  if (direction.includes("s")) {
    bottom = clamp(
      bottom + deltaY,
      top + bounds.minimumHeight,
      bounds.maximumY,
    );
  }

  if (direction.includes("n")) {
    top = clamp(
      top + deltaY,
      bounds.minimumY,
      bottom - bounds.minimumHeight,
    );
  }

  return normalizeConsoleWindowState(
    {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      isOpen: normalized.isOpen,
    },
    viewport,
  );
}

export function parseConsoleWindowState(
  serialized: string | null,
  viewport: ConsoleViewport,
): ConsoleWindowState {
  if (!serialized) {
    return getDefaultConsoleWindowState(viewport);
  }

  try {
    const candidate = JSON.parse(serialized) as Partial<StoredConsoleWindowState>;

    if (candidate.version !== 1) {
      return getDefaultConsoleWindowState(viewport);
    }

    return normalizeConsoleWindowState(candidate, viewport);
  } catch {
    return getDefaultConsoleWindowState(viewport);
  }
}

export function loadConsoleWindowState(
  storage: ConsoleWindowStorage,
  viewport: ConsoleViewport,
): ConsoleWindowState {
  try {
    return parseConsoleWindowState(
      storage.getItem(CONSOLE_WINDOW_STORAGE_KEY),
      viewport,
    );
  } catch {
    return getDefaultConsoleWindowState(viewport);
  }
}

export function saveConsoleWindowState(
  storage: ConsoleWindowStorage,
  state: ConsoleWindowState,
  viewport: ConsoleViewport,
): void {
  const payload: StoredConsoleWindowState = {
    version: 1,
    ...normalizeConsoleWindowState(state, viewport),
  };

  try {
    storage.setItem(CONSOLE_WINDOW_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
