import { describe, expect, it } from "vitest";
import { isPositionBlocked } from "./collision";
import { OBSTACLES } from "./constants";
import {
  ObstacleSpatialIndex,
  SpatialHash2D,
} from "./SpatialHash2D";

describe("SpatialHash2D", () => {
  it("returns a collider only once when it spans several cells", () => {
    const hash = new SpatialHash2D(50, 4);
    const output: number[] = [];
    hash.insertStatic(7, {
      minimumX: -5,
      maximumX: 5,
      minimumZ: -5,
      maximumZ: 5,
    });

    hash.query(
      { minimumX: -2, maximumX: 2, minimumZ: -2, maximumZ: 2 },
      output,
    );
    expect(output).toEqual([7]);
  });

  it("clears dynamic buckets without disturbing static colliders", () => {
    const hash = new SpatialHash2D(10, 4);
    const output: number[] = [];
    const bounds = {
      minimumX: -1,
      maximumX: 1,
      minimumZ: -1,
      maximumZ: 1,
    };
    hash.insertStatic(1, bounds);
    hash.insertDynamic(2, bounds);
    hash.query(bounds, output);
    expect(output).toEqual([1, 2]);

    hash.clearDynamic();
    hash.query(bounds, output);
    expect(output).toEqual([1]);
  });

  it("matches the exact linear collision result across the arena", () => {
    const index = new ObstacleSpatialIndex(OBSTACLES);
    let seed = 123_456_789;

    for (let sample = 0; sample < 1_000; sample += 1) {
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      const x = (seed / 0xffffffff) * 110 - 55;
      seed = (seed * 1_664_525 + 1_013_904_223) >>> 0;
      const z = (seed / 0xffffffff) * 110 - 55;
      const point = { x, z };

      expect(index.isPositionBlocked(point, 0.45)).toBe(
        isPositionBlocked(point, 0.45, OBSTACLES, 50),
      );
    }
  });
});
