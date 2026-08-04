import { describe, expect, it } from "vitest";
import { createGameLogStore } from "./gameLog";
import {
  createFrozenGameLogView,
  getFrozenViewNewEntryCount,
  isFrozenViewCurrent,
} from "./gameLogView";

const player = { id: "player", kind: "player", displayName: "Jimbo" } as const;
const carpet = {
  id: "carpet",
  kind: "entity",
  displayName: "Alfombra ardiente",
} as const;

describe("frozen game log views", () => {
  it("keeps the inspected entries stable while counting new events", () => {
    const store = createGameLogStore(3);
    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 10 });
    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 20 });
    const frozen = createFrozenGameLogView(
      store.getSnapshot(),
      store.readEntries(),
    );

    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 30 });
    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 40 });

    expect(frozen.entries.map((entry) => entry.appliedDamage)).toEqual([10, 20]);
    expect(getFrozenViewNewEntryCount(store.getSnapshot(), frozen)).toBe(2);
    expect(isFrozenViewCurrent(store.getSnapshot(), frozen)).toBe(true);
  });

  it("invalidates a frozen view after clearing the store", () => {
    const store = createGameLogStore();
    store.publishDamage({ receiver: player, source: carpet, appliedDamage: 10 });
    const frozen = createFrozenGameLogView(
      store.getSnapshot(),
      store.readEntries(),
    );

    store.clear();

    expect(isFrozenViewCurrent(store.getSnapshot(), frozen)).toBe(false);
    expect(getFrozenViewNewEntryCount(store.getSnapshot(), frozen)).toBe(0);
  });
});
