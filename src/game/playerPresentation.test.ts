import { describe, expect, it } from "vitest";
import {
  getActivePlayerStats,
  PLAYER_PLACEHOLDER_STAT_CATEGORIES,
} from "./playerPresentation";

describe("player stats presentation", () => {
  it("highlights only stats that are connected to gameplay", () => {
    expect(getActivePlayerStats(1_500)).toEqual([
      expect.objectContaining({ id: "auto-attack-damage", value: 20, status: "active" }),
      expect.objectContaining({ id: "maximum-health", value: 1_500, status: "active" }),
      expect.objectContaining({ id: "movement-speed", value: 5.5, status: "active" }),
      expect.objectContaining({ id: "attack-speed", value: 1, status: "active" }),
    ]);
  });

  it("keeps every remaining base stat marked as a placeholder", () => {
    const placeholders = PLAYER_PLACEHOLDER_STAT_CATEGORIES.flatMap(
      (category) => category.stats,
    );

    expect(placeholders.length).toBeGreaterThan(0);
    expect(placeholders.every((stat) => stat.status === "placeholder")).toBe(true);
    expect(placeholders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "armor", value: 0 }),
        expect.objectContaining({ id: "maximum-energy", value: 120 }),
        expect.objectContaining({ id: "monster-damage", value: 0 }),
      ]),
    );
  });
});
