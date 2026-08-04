interface PlayerIdentityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredPlayerIdentity {
  version: 1;
  displayName: string;
}

export const PLAYER_IDENTITY_STORAGE_KEY = "arena-rpg.player-identity.v1";
export const DEFAULT_PLAYER_NAME = "Jimbo";
export const PLAYER_NAME_MAX_LENGTH = 24;

export function normalizePlayerName(
  value: unknown,
  fallback = DEFAULT_PLAYER_NAME,
): string {
  const normalizedFallback =
    typeof fallback === "string" && fallback.trim().length > 0
      ? fallback.trim().slice(0, PLAYER_NAME_MAX_LENGTH)
      : DEFAULT_PLAYER_NAME;

  if (typeof value !== "string") {
    return normalizedFallback;
  }

  const normalized = value.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  return normalized.length > 0 ? normalized : normalizedFallback;
}

export function parsePlayerIdentity(serialized: string | null): string {
  if (!serialized) {
    return DEFAULT_PLAYER_NAME;
  }

  try {
    const candidate = JSON.parse(serialized) as Partial<StoredPlayerIdentity>;

    if (candidate.version !== 1) {
      return DEFAULT_PLAYER_NAME;
    }

    return normalizePlayerName(candidate.displayName);
  } catch {
    return DEFAULT_PLAYER_NAME;
  }
}

export function loadPlayerName(storage: PlayerIdentityStorage): string {
  try {
    return parsePlayerIdentity(storage.getItem(PLAYER_IDENTITY_STORAGE_KEY));
  } catch {
    return DEFAULT_PLAYER_NAME;
  }
}

export function savePlayerName(
  storage: PlayerIdentityStorage,
  displayName: string,
): void {
  const payload: StoredPlayerIdentity = {
    version: 1,
    displayName: normalizePlayerName(displayName),
  };

  try {
    storage.setItem(PLAYER_IDENTITY_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
