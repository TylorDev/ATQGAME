import {
  ARENA_HALF_SIZE_METERS,
  ARRIVAL_DISTANCE_METERS,
  HOLD_DELAY_MS,
  MAX_FRAME_DELTA_SECONDS,
  MIN_DIRECTION_LENGTH_METERS,
  PLAYER_BASE_SPEED_METERS_PER_SECOND,
  PLAYER_RADIUS_METERS,
} from "./constants";
import { isPositionBlocked } from "./collision";
import { calculateGroundDistanceMeters } from "./distance";
import type {
  GroundPoint,
  MovementMode,
  MovementSnapshot,
  ObstacleDefinition,
} from "./types";

type MovementIntent = Exclude<MovementMode, "blocked" | "followTarget">;

interface MovementControllerOptions {
  initialPosition?: GroundPoint;
  radiusMeters?: number;
  arenaHalfSizeMeters?: number;
  holdDelayMs?: number;
}

function copyPoint(point: GroundPoint): GroundPoint {
  return { x: point.x, z: point.z };
}

function directionBetween(from: GroundPoint, to: GroundPoint): GroundPoint {
  const x = to.x - from.x;
  const z = to.z - from.z;
  const length = Math.hypot(x, z);

  if (length <= MIN_DIRECTION_LENGTH_METERS) {
    return { x: 0, z: 0 };
  }

  return { x: x / length, z: z / length };
}

export class MovementController {
  private readonly radiusMeters: number;
  private readonly arenaHalfSizeMeters: number;
  private readonly holdDelayMs: number;
  private position: GroundPoint;
  private facing: GroundPoint = { x: 0, z: 1 };
  private intent: MovementIntent = "idle";
  private blocked = false;
  private pointerDown = false;
  private pressStartedAt: number | null = null;
  private pointerGround: GroundPoint | null = null;
  private target: GroundPoint | null = null;
  private followTarget: GroundPoint | null = null;
  private followStoppingDistanceMeters = 0;
  private isClickTargetConfirmed = false;
  private speedMetersPerSecond = 0;

  constructor(options: MovementControllerOptions = {}) {
    this.position = copyPoint(options.initialPosition ?? { x: 0, z: 0 });
    this.radiusMeters = options.radiusMeters ?? PLAYER_RADIUS_METERS;
    this.arenaHalfSizeMeters =
      options.arenaHalfSizeMeters ?? ARENA_HALF_SIZE_METERS;
    this.holdDelayMs = options.holdDelayMs ?? HOLD_DELAY_MS;
  }

  beginRightPress(point: GroundPoint, timestamp: number): void {
    this.pointerDown = true;
    this.pressStartedAt = timestamp;
    this.pointerGround = copyPoint(point);
    this.target = copyPoint(point);
    this.intent = "clickToPoint";
    this.blocked = false;
    this.isClickTargetConfirmed = false;
    this.speedMetersPerSecond = 0;
  }

  updatePointerGround(point: GroundPoint): void {
    this.pointerGround = copyPoint(point);
  }

  setFollowTarget(target: GroundPoint, stoppingDistanceMeters: number): void {
    this.resumeFollowTarget(target, stoppingDistanceMeters);
  }

  resumeFollowTarget(target: GroundPoint, stoppingDistanceMeters: number): void {
    this.pointerDown = false;
    this.pressStartedAt = null;
    this.pointerGround = null;
    this.target = null;
    this.intent = "idle";
    this.followTarget = copyPoint(target);
    this.followStoppingDistanceMeters = Math.max(stoppingDistanceMeters, 0);
    this.blocked = false;
    this.isClickTargetConfirmed = false;
    this.speedMetersPerSecond = 0;
  }

  pauseFollowTarget(): void {
    this.followTarget = null;
    this.followStoppingDistanceMeters = 0;
    this.blocked = false;
  }

  clearFollowTarget(): void {
    this.pauseFollowTarget();
  }

  endRightPress(timestamp: number): void {
    if (!this.pointerDown) {
      return;
    }

    const pressDuration =
      this.pressStartedAt === null ? 0 : timestamp - this.pressStartedAt;
    const wasHold =
      this.intent === "holdDirection" || pressDuration >= this.holdDelayMs;

    this.pointerDown = false;
    this.pressStartedAt = null;

    if (wasHold) {
      this.intent = "idle";
      this.target = null;
      this.blocked = false;
      this.isClickTargetConfirmed = false;
      this.speedMetersPerSecond = 0;
    } else if (this.intent === "clickToPoint" && this.target) {
      this.isClickTargetConfirmed = true;
    }
  }

  cancelInput(): void {
    this.pointerDown = false;
    this.pressStartedAt = null;
    this.pointerGround = null;
    this.target = null;
    this.intent = "idle";
    this.blocked = false;
    this.isClickTargetConfirmed = false;
    this.speedMetersPerSecond = 0;
  }

  step(
    deltaSeconds: number,
    timestamp: number,
    obstacles: readonly ObstacleDefinition[],
    speedMetersPerSecond = PLAYER_BASE_SPEED_METERS_PER_SECOND,
  ): MovementSnapshot {
    const startingPosition = copyPoint(this.position);
    const safeDeltaSeconds = Math.min(
      Math.max(deltaSeconds, 0),
      MAX_FRAME_DELTA_SECONDS,
    );

    if (
      this.pointerDown &&
      this.pressStartedAt !== null &&
      timestamp - this.pressStartedAt >= this.holdDelayMs &&
      this.intent !== "holdDirection"
    ) {
      this.intent = "holdDirection";
      this.target = null;
      this.blocked = false;
      this.isClickTargetConfirmed = false;
    }

    const isFollowing = this.intent === "idle" && this.followTarget !== null;
    const destination =
      this.intent === "clickToPoint"
        ? this.target
        : this.intent === "holdDirection"
          ? this.pointerGround
          : this.followTarget;

    if ((!isFollowing && this.intent === "idle") || !destination) {
      return this.snapshotAfterStep(startingPosition, safeDeltaSeconds);
    }

    const remainingDistanceMeters = calculateGroundDistanceMeters(
      this.position,
      destination,
    );

    if (isFollowing && remainingDistanceMeters <= this.followStoppingDistanceMeters) {
      this.blocked = false;
      return this.snapshotAfterStep(startingPosition, safeDeltaSeconds);
    }

    if (this.intent === "clickToPoint" && remainingDistanceMeters <= ARRIVAL_DISTANCE_METERS) {
      this.position = copyPoint(destination);
      this.target = null;
      this.intent = "idle";
      this.blocked = false;
      this.isClickTargetConfirmed = false;
      return this.snapshotAfterStep(startingPosition, safeDeltaSeconds);
    }

    const direction = directionBetween(this.position, destination);

    if (direction.x === 0 && direction.z === 0) {
      return this.snapshotAfterStep(startingPosition, safeDeltaSeconds);
    }

    const requestedDistanceMeters = speedMetersPerSecond * safeDeltaSeconds;
    const movementDistanceMeters = isFollowing
      ? Math.min(
          requestedDistanceMeters,
          remainingDistanceMeters - this.followStoppingDistanceMeters,
        )
      : this.intent === "clickToPoint"
        ? Math.min(requestedDistanceMeters, remainingDistanceMeters)
        : requestedDistanceMeters;
    const candidate = {
      x: this.position.x + direction.x * movementDistanceMeters,
      z: this.position.z + direction.z * movementDistanceMeters,
    };

    this.facing = direction;

    if (
      isPositionBlocked(
        candidate,
        this.radiusMeters,
        obstacles,
        this.arenaHalfSizeMeters,
      )
    ) {
      this.blocked = true;

      if (this.intent === "clickToPoint") {
        this.intent = "idle";
        this.target = null;
        this.isClickTargetConfirmed = false;
      }

      return this.snapshotAfterStep(startingPosition, safeDeltaSeconds);
    }

    this.position = candidate;
    this.blocked = false;

    if (
      this.intent === "clickToPoint" &&
      remainingDistanceMeters <= requestedDistanceMeters
    ) {
      this.position = copyPoint(destination);
      this.target = null;
      this.intent = "idle";
      this.isClickTargetConfirmed = false;
    }

    return this.snapshotAfterStep(startingPosition, safeDeltaSeconds);
  }

  getSnapshot(): MovementSnapshot {
    return this.snapshot();
  }

  private snapshot(): MovementSnapshot {
    return {
      mode: this.blocked
        ? "blocked"
        : this.intent === "idle" && this.followTarget
          ? "followTarget"
          : this.intent,
      position: copyPoint(this.position),
      facing: copyPoint(this.facing),
      target: this.target ? copyPoint(this.target) : null,
      followTarget: this.followTarget ? copyPoint(this.followTarget) : null,
      isClickTargetConfirmed: this.isClickTargetConfirmed,
      speedMetersPerSecond: this.speedMetersPerSecond,
    };
  }

  private snapshotAfterStep(
    startingPosition: GroundPoint,
    deltaSeconds: number,
  ): MovementSnapshot {
    this.speedMetersPerSecond =
      deltaSeconds > 0
        ? calculateGroundDistanceMeters(startingPosition, this.position) /
          deltaSeconds
        : 0;

    return this.snapshot();
  }
}
