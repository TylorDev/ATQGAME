import { ARENA_HALF_SIZE_METERS } from "./constants";
import {
  circleIntersectsObstacle,
  isOutsideArena,
  type PositionBlocker,
} from "./collision";
import type { GroundPoint, ObstacleDefinition } from "./types";

export const SPATIAL_HASH_CELL_SIZE_METERS = 4;

export interface SpatialBounds {
  minimumX: number;
  maximumX: number;
  minimumZ: number;
  maximumZ: number;
}

function createBuckets(count: number): number[][] {
  return Array.from({ length: count }, () => []);
}

export class SpatialHash2D {
  private readonly cellsPerAxis: number;
  private readonly staticBuckets: number[][];
  private readonly dynamicBuckets: number[][];
  private marks = new Uint32Array(32);
  private generation = 0;

  constructor(
    private readonly halfSizeMeters = ARENA_HALF_SIZE_METERS,
    private readonly cellSizeMeters = SPATIAL_HASH_CELL_SIZE_METERS,
  ) {
    this.cellsPerAxis = Math.ceil(
      (halfSizeMeters * 2) / this.cellSizeMeters,
    );
    const bucketCount = this.cellsPerAxis * this.cellsPerAxis;
    this.staticBuckets = createBuckets(bucketCount);
    this.dynamicBuckets = createBuckets(bucketCount);
  }

  insertStatic(index: number, bounds: SpatialBounds): void {
    this.insert(this.staticBuckets, index, bounds);
  }

  insertDynamic(index: number, bounds: SpatialBounds): void {
    this.insert(this.dynamicBuckets, index, bounds);
  }

  clearDynamic(): void {
    for (let index = 0; index < this.dynamicBuckets.length; index += 1) {
      this.dynamicBuckets[index].length = 0;
    }
  }

  query(bounds: SpatialBounds, output: number[]): number {
    output.length = 0;
    this.generation = (this.generation + 1) >>> 0;

    if (this.generation === 0) {
      this.marks.fill(0);
      this.generation = 1;
    }

    const minimumCellX = this.toCell(bounds.minimumX);
    const maximumCellX = this.toCell(bounds.maximumX);
    const minimumCellZ = this.toCell(bounds.minimumZ);
    const maximumCellZ = this.toCell(bounds.maximumZ);

    for (let z = minimumCellZ; z <= maximumCellZ; z += 1) {
      for (let x = minimumCellX; x <= maximumCellX; x += 1) {
        const bucketIndex = z * this.cellsPerAxis + x;
        this.appendUnique(this.staticBuckets[bucketIndex], output);
        this.appendUnique(this.dynamicBuckets[bucketIndex], output);
      }
    }

    return output.length;
  }

  private insert(
    buckets: number[][],
    index: number,
    bounds: SpatialBounds,
  ): void {
    if (!Number.isInteger(index) || index < 0) {
      return;
    }

    this.ensureMarkCapacity(index);
    const minimumCellX = this.toCell(bounds.minimumX);
    const maximumCellX = this.toCell(bounds.maximumX);
    const minimumCellZ = this.toCell(bounds.minimumZ);
    const maximumCellZ = this.toCell(bounds.maximumZ);

    for (let z = minimumCellZ; z <= maximumCellZ; z += 1) {
      for (let x = minimumCellX; x <= maximumCellX; x += 1) {
        buckets[z * this.cellsPerAxis + x].push(index);
      }
    }
  }

  private appendUnique(bucket: readonly number[], output: number[]): void {
    for (let index = 0; index < bucket.length; index += 1) {
      const colliderIndex = bucket[index];
      this.ensureMarkCapacity(colliderIndex);

      if (this.marks[colliderIndex] === this.generation) {
        continue;
      }

      this.marks[colliderIndex] = this.generation;
      output.push(colliderIndex);
    }
  }

  private ensureMarkCapacity(index: number): void {
    if (index < this.marks.length) {
      return;
    }

    let nextLength = this.marks.length;

    while (nextLength <= index) {
      nextLength *= 2;
    }

    const nextMarks = new Uint32Array(nextLength);
    nextMarks.set(this.marks);
    this.marks = nextMarks;
  }

  private toCell(value: number): number {
    const normalized = Math.floor(
      (value + this.halfSizeMeters) / this.cellSizeMeters,
    );
    return Math.min(Math.max(normalized, 0), this.cellsPerAxis - 1);
  }
}

export class ObstacleSpatialIndex implements PositionBlocker {
  private readonly hash: SpatialHash2D;
  private readonly candidates: number[] = [];
  private readonly queryBounds: SpatialBounds = {
    minimumX: 0,
    maximumX: 0,
    minimumZ: 0,
    maximumZ: 0,
  };

  constructor(
    private readonly obstacles: readonly ObstacleDefinition[],
    private readonly arenaHalfSizeMeters = ARENA_HALF_SIZE_METERS,
    cellSizeMeters = SPATIAL_HASH_CELL_SIZE_METERS,
  ) {
    this.hash = new SpatialHash2D(arenaHalfSizeMeters, cellSizeMeters);

    for (let index = 0; index < obstacles.length; index += 1) {
      const obstacle = obstacles[index];
      const halfWidth = obstacle.widthMeters / 2;
      const halfDepth = obstacle.depthMeters / 2;
      this.hash.insertStatic(index, {
        minimumX: obstacle.xMeters - halfWidth,
        maximumX: obstacle.xMeters + halfWidth,
        minimumZ: obstacle.zMeters - halfDepth,
        maximumZ: obstacle.zMeters + halfDepth,
      });
    }
  }

  isPositionBlocked(position: GroundPoint, radiusMeters: number): boolean {
    if (isOutsideArena(position, radiusMeters, this.arenaHalfSizeMeters)) {
      return true;
    }

    this.queryBounds.minimumX = position.x - radiusMeters;
    this.queryBounds.maximumX = position.x + radiusMeters;
    this.queryBounds.minimumZ = position.z - radiusMeters;
    this.queryBounds.maximumZ = position.z + radiusMeters;
    this.hash.query(this.queryBounds, this.candidates);

    for (let index = 0; index < this.candidates.length; index += 1) {
      const obstacle = this.obstacles[this.candidates[index]];

      if (
        obstacle &&
        circleIntersectsObstacle(position, radiusMeters, obstacle)
      ) {
        return true;
      }
    }

    return false;
  }
}
