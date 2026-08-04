import { describe, expect, it, vi } from "vitest";
import {
  createGameLogStore,
  formatAreaPresenceLogMessage,
  formatDamageLogEntry,
  formatDamageLogMessage,
  formatGameLogEntry,
  MAX_GAME_LOG_ENTRIES,
  type GameLogEntry,
} from "./gameLog";

const player = { id: "player", kind: "player", displayName: "Jimbo" } as const;
const carpet = {
  id: "carpet",
  kind: "entity",
  displayName: "Alfombra ardiente",
} as const;
const dummy = {
  id: "dummy",
  kind: "test-dummy",
  displayName: "Muñeco de pruebas",
} as const;

function getDamageAmount(entry: GameLogEntry | undefined): number | undefined {
  return entry?.type === "damage" ? entry.appliedDamage : undefined;
}

describe("game log store", () => {
  it("retains the latest 2,000 events and reports discarded history", () => {
    const store = createGameLogStore();

    for (let index = 0; index < 2_500; index += 1) {
      store.publishDamage({
        occurredAtMs: index,
        receiver: dummy,
        source: player,
        appliedDamage: index + 1,
      });
    }

    expect(store.getSnapshot()).toMatchObject({
      count: MAX_GAME_LOG_ENTRIES,
      publishedCount: 2_500,
      discardedCount: 500,
      generation: 0,
    });
    expect(getDamageAmount(store.getEntry(0))).toBe(501);
    expect(getDamageAmount(store.getEntry(1_999))).toBe(2_500);
    expect(store.readEntries()).toHaveLength(MAX_GAME_LOG_ENTRIES);
  });

  it("reads wrapped entries in chronological order with O(1) indexed access", () => {
    const store = createGameLogStore(3);

    for (let amount = 1; amount <= 5; amount += 1) {
      store.publishDamage({ receiver: dummy, source: player, appliedDamage: amount });
    }

    expect(store.readEntries().map((entry) => getDamageAmount(entry))).toEqual([
      3,
      4,
      5,
    ]);
    expect(store.getEntry(-1)).toBeUndefined();
    expect(store.getEntry(3)).toBeUndefined();
  });

  it("notifies subscribers when adding or clearing entries", () => {
    const store = createGameLogStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 100 });
    store.clear();
    unsubscribe();
    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 50 });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(store.getSnapshot().count).toBe(1);
  });

  it("keeps snapshots stable until a valid mutation and resets the generation", () => {
    const store = createGameLogStore(2);
    const initialSnapshot = store.getSnapshot();

    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 0 });
    expect(store.getSnapshot()).toBe(initialSnapshot);

    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 10 });
    const populatedSnapshot = store.getSnapshot();
    expect(populatedSnapshot).not.toBe(initialSnapshot);
    expect(store.getHasEntriesSnapshot()).toBe(true);

    store.clear();
    expect(store.getSnapshot()).toMatchObject({
      count: 0,
      publishedCount: 0,
      discardedCount: 0,
      generation: 1,
    });
    expect(store.getHasEntriesSnapshot()).toBe(false);
  });

  it("ignores zero, negative and non-finite damage", () => {
    const store = createGameLogStore();

    expect(
      store.publishDamage({ receiver: player, source: carpet, appliedDamage: 0 }),
    ).toBeNull();
    expect(
      store.publishDamage({ receiver: player, source: carpet, appliedDamage: -1 }),
    ).toBeNull();
    expect(
      store.publishDamage({ receiver: player, source: carpet, appliedDamage: NaN }),
    ).toBeNull();
    expect(store.getSnapshot().count).toBe(0);
  });

  it("stores damage and area events together in chronological order", () => {
    const store = createGameLogStore(4);

    store.publishDamage({
      occurredAtMs: 1,
      receiver: dummy,
      source: player,
      appliedDamage: 20,
    });
    store.publishAreaPresence({
      occurredAtMs: 2,
      target: dummy,
      status: "inside",
      areaRadiusMeters: 10,
    });
    store.publishAreaPresence({
      occurredAtMs: 3,
      target: dummy,
      status: "deactivated",
      areaRadiusMeters: 10,
    });

    expect(store.readEntries().map((entry) => entry.type)).toEqual([
      "damage",
      "area-presence",
      "area-presence",
    ]);
    expect(store.getSnapshot().publishedCount).toBe(3);
  });

  it("rejects area events with an invalid radius", () => {
    const store = createGameLogStore();

    expect(
      store.publishAreaPresence({
        target: dummy,
        status: "inside",
        areaRadiusMeters: 0,
      }),
    ).toBeNull();
    expect(store.getSnapshot().count).toBe(0);
  });

  it("formats local time, typed actors and decimal damage", () => {
    const occurredAtMs = new Date(2026, 0, 1, 14, 54, 30).getTime();
    const store = createGameLogStore();
    const playerDamage = store.publishDamage({
      occurredAtMs,
      receiver: player,
      source: carpet,
      appliedDamage: 12.5,
    });
    const dummyDamage = store.publishDamage({
      occurredAtMs,
      receiver: dummy,
      source: player,
      appliedDamage: 20,
    });

    expect(playerDamage && formatDamageLogEntry(playerDamage)).toBe(
      '14:54:30 DAÑO · Jugador "Jimbo" recibió 12,5 de daño de Entidad "Alfombra ardiente".',
    );
    expect(dummyDamage && formatDamageLogMessage(dummyDamage)).toBe(
      'Muñeco de pruebas recibió 20 de daño de Jugador "Jimbo".',
    );
  });

  it("formats inside, outside and deactivated area states", () => {
    const occurredAtMs = new Date(2026, 0, 1, 14, 54, 30).getTime();
    const store = createGameLogStore();
    const inside = store.publishAreaPresence({
      occurredAtMs,
      target: dummy,
      status: "inside",
      areaRadiusMeters: 10,
    });
    const outside = store.publishAreaPresence({
      occurredAtMs,
      target: dummy,
      status: "outside",
      areaRadiusMeters: 10,
    });
    const deactivated = store.publishAreaPresence({
      occurredAtMs,
      target: dummy,
      status: "deactivated",
      areaRadiusMeters: 10,
    });

    expect(inside && formatAreaPresenceLogMessage(inside)).toBe(
      "Muñeco de pruebas está DENTRO del área de 10 m.",
    );
    expect(outside && formatGameLogEntry(outside)).toBe(
      "14:54:30 ÁREA · Muñeco de pruebas está FUERA del área de 10 m.",
    );
    expect(deactivated && formatAreaPresenceLogMessage(deactivated)).toBe(
      "Área de 10 m desactivada.",
    );
  });
});
