import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAYER_NAME,
  loadPlayerName,
  normalizePlayerName,
  PLAYER_IDENTITY_STORAGE_KEY,
  savePlayerName,
} from "./playerIdentity";

describe("player identity", () => {
  it("normalizes whitespace, length and empty values", () => {
    expect(normalizePlayerName("  Jimbo  ")).toBe("Jimbo");
    expect(normalizePlayerName("", "Último nombre")).toBe("Último nombre");
    expect(normalizePlayerName("x".repeat(30))).toBe("x".repeat(24));
  });

  it("loads and saves a versioned local name", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    savePlayerName(storage, "  Nyra  ");

    expect(values.has(PLAYER_IDENTITY_STORAGE_KEY)).toBe(true);
    expect(loadPlayerName(storage)).toBe("Nyra");
  });

  it("uses the default for malformed or unsupported data", () => {
    const storage = {
      getItem: () => '{"version":2,"displayName":"Otro"}',
      setItem: () => undefined,
    };

    expect(loadPlayerName(storage)).toBe(DEFAULT_PLAYER_NAME);
  });
});
