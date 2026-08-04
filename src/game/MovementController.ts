import {
  ARENA_HALF_SIZE_METERS,
  ARRIVAL_DISTANCE_METERS,
  HOLD_DELAY_MS,
  MAX_MOVEMENT_STEP_SECONDS,
  MIN_DIRECTION_LENGTH_METERS,
  PLAYER_BASE_SPEED_METERS_PER_SECOND,
  PLAYER_RADIUS_METERS,
} from "./constants";
import {
  isPositionBlocked,
  type PositionBlocker,
} from "./collision";
import type {
  GroundPoint,
  MovementMode,
  MovementSnapshot,
  ObstacleDefinition,
} from "./types";

type MovementIntent = Exclude<MovementMode, "blocked" | "followTarget">;
export type MovementCollisionSource =
  | readonly ObstacleDefinition[]
  | PositionBlocker;

interface MovementControllerOptions {
  initialPosition?: GroundPoint;
  radiusMeters?: number;
  arenaHalfSizeMeters?: number;
  holdDelayMs?: number;
}

export interface MovementStateView {
  mode: MovementMode;
  readonly position: GroundPoint;
  readonly facing: GroundPoint;
  target: GroundPoint | null;
  followTarget: GroundPoint | null;
  isClickTargetConfirmed: boolean;
  speedMetersPerSecond: number;
}

function setPoint(target: GroundPoint, source: GroundPoint): void {
  target.x = source.x;
  target.z = source.z;
}

function writePoint(
  target: GroundPoint | null,
  source: GroundPoint | null,
): GroundPoint | null {
  if (!source) {
    return null;
  }

  const output = target ?? { x: 0, z: 0 };
  setPoint(output, source);
  return output;
}

function isBlocked(
  source: MovementCollisionSource,
  position: GroundPoint,
  radiusMeters: number,
  arenaHalfSizeMeters: number,
): boolean {
  if ("isPositionBlocked" in source) {
    return source.isPositionBlocked(position, radiusMeters);
  }

  return isPositionBlocked(
    position,
    radiusMeters,
    source,
    arenaHalfSizeMeters,
  );
}

export class MovementController {
  private readonly radiusMeters: number;
  private readonly arenaHalfSizeMeters: number;
  private readonly holdDelayMs: number;
  private readonly position: GroundPoint = { x: 0, z: 0 };
  private readonly facing: GroundPoint = { x: 0, z: 1 };
  private readonly pointerGroundPoint: GroundPoint = { x: 0, z: 0 };
  private readonly targetPoint: GroundPoint = { x: 0, z: 0 };
  private readonly followTargetPoint: GroundPoint = { x: 0, z: 0 };
  private readonly startingPosition: GroundPoint = { x: 0, z: 0 };
  private readonly direction: GroundPoint = { x: 0, z: 0 };
  private readonly candidate: GroundPoint = { x: 0, z: 0 };
  private readonly state: MovementStateView = {
    mode: "idle",
    position: this.position,
    facing: this.facing,
    target: null,
    followTarget: null,
    isClickTargetConfirmed: false,
    speedMetersPerSecond: 0,
  };
  private intent: MovementIntent = "idle";
  private blocked = false;
  private pointerDown = false;
  private pressStartedAt: number | null = null;
  private pressElapsedMs = 0;
  private hasPointerGround = false;
  private hasTarget = false;
  private hasFollowTarget = false;
  private followStoppingDistanceMeters = 0;

  constructor(options: MovementControllerOptions = {}) {
    setPoint(this.position, options.initialPosition ?? { x: 0, z: 0 });
    this.radiusMeters = options.radiusMeters ?? PLAYER_RADIUS_METERS;
    this.arenaHalfSizeMeters =
      options.arenaHalfSizeMeters ?? ARENA_HALF_SIZE_METERS;
    this.holdDelayMs = options.holdDelayMs ?? HOLD_DELAY_MS;
    this.syncState();
  }

  beginRightPress(point: GroundPoint, timestamp: number): void {
    this.pointerDown = true;
    this.pressStartedAt = timestamp;
    this.pressElapsedMs = 0;
    setPoint(this.pointerGroundPoint, point);
    setPoint(this.targetPoint, point);
    this.hasPointerGround = true;
    this.hasTarget = true;
    this.intent = "clickToPoint";
    this.blocked = false;
    this.state.isClickTargetConfirmed = false;
    this.state.speedMetersPerSecond = 0;
    this.syncState();
  }

  updatePointerGround(point: GroundPoint): void {
    setPoint(this.pointerGroundPoint, point);
    this.hasPointerGround = true;

    if (this.pointerDown && this.intent !== "holdDirection") {
      setPoint(this.targetPoint, point);
      this.hasTarget = true;
      this.intent = "clickToPoint";
      this.blocked = false;
      this.state.isClickTargetConfirmed = false;
      this.syncState();
    }
  }

  setFollowTarget(target: GroundPoint, stoppingDistanceMeters: number): void {
    this.resumeFollowTarget(target, stoppingDistanceMeters);
  }

  resumeFollowTarget(target: GroundPoint, stoppingDistanceMeters: number): void {
    this.pointerDown = false;
    this.pressStartedAt = null;
    this.pressElapsedMs = 0;
    this.hasPointerGround = false;
    this.hasTarget = false;
    this.intent = "idle";
    setPoint(this.followTargetPoint, target);
    this.hasFollowTarget = true;
    this.followStoppingDistanceMeters = Math.max(stoppingDistanceMeters, 0);
    this.blocked = false;
    this.state.isClickTargetConfirmed = false;
    this.state.speedMetersPerSecond = 0;
    this.syncState();
  }

  pauseFollowTarget(): void {
    this.hasFollowTarget = false;
    this.followStoppingDistanceMeters = 0;
    this.blocked = false;
    this.syncState();
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
    this.pressElapsedMs = 0;

    if (wasHold) {
      this.intent = "idle";
      this.hasTarget = false;
      this.blocked = false;
      this.state.isClickTargetConfirmed = false;
      this.state.speedMetersPerSecond = 0;
    } else if (this.intent === "clickToPoint" && this.hasTarget) {
      this.state.isClickTargetConfirmed = true;
    }

    this.syncState();
  }

  cancelInput(): void {
    this.pointerDown = false;
    this.pressStartedAt = null;
    this.pressElapsedMs = 0;
    this.hasPointerGround = false;
    this.hasTarget = false;
    this.intent = "idle";
    this.blocked = false;
    this.state.isClickTargetConfirmed = false;
    this.state.speedMetersPerSecond = 0;
    this.syncState();
  }

  step(
    deltaSeconds: number,
    _timestamp: number,
    collisionSource: MovementCollisionSource,
    speedMetersPerSecond = PLAYER_BASE_SPEED_METERS_PER_SECOND,
  ): void {
    setPoint(this.startingPosition, this.position);
    const safeDeltaSeconds = Math.min(
      Math.max(deltaSeconds, 0),
      MAX_MOVEMENT_STEP_SECONDS,
    );

    if (this.pointerDown) {
      this.pressElapsedMs += safeDeltaSeconds * 1_000;
    }

    if (
      this.pointerDown &&
      this.pressElapsedMs >= this.holdDelayMs &&
      this.intent !== "holdDirection"
    ) {
      this.intent = "holdDirection";
      this.hasTarget = false;
      this.blocked = false;
      this.state.isClickTargetConfirmed = false;
    }

    const isFollowing = this.intent === "idle" && this.hasFollowTarget;
    const isPointerSteering = this.pointerDown && this.hasPointerGround;
    const destination =
      isPointerSteering
        ? this.pointerGroundPoint
        : this.intent === "clickToPoint" && this.hasTarget
          ? this.targetPoint
          : this.intent === "holdDirection" && this.hasPointerGround
            ? this.pointerGroundPoint
            : this.hasFollowTarget
              ? this.followTargetPoint
              : null;

    if (
      (!isPointerSteering && !isFollowing && this.intent === "idle") ||
      !destination
    ) {
      this.finishStep(safeDeltaSeconds);
      return;
    }

    const distanceX = destination.x - this.position.x;
    const distanceZ = destination.z - this.position.z;
    const remainingDistanceMeters = Math.hypot(distanceX, distanceZ);

    if (
      isFollowing &&
      remainingDistanceMeters <= this.followStoppingDistanceMeters
    ) {
      this.blocked = false;
      this.finishStep(safeDeltaSeconds);
      return;
    }

    if (
      !isPointerSteering &&
      this.intent === "clickToPoint" &&
      remainingDistanceMeters <= ARRIVAL_DISTANCE_METERS
    ) {
      setPoint(this.position, destination);
      this.hasTarget = false;
      this.intent = "idle";
      this.blocked = false;
      this.state.isClickTargetConfirmed = false;
      this.finishStep(safeDeltaSeconds);
      return;
    }

    if (remainingDistanceMeters <= MIN_DIRECTION_LENGTH_METERS) {
      this.direction.x = 0;
      this.direction.z = 0;
      this.finishStep(safeDeltaSeconds);
      return;
    }

    this.direction.x = distanceX / remainingDistanceMeters;
    this.direction.z = distanceZ / remainingDistanceMeters;
    const requestedDistanceMeters = speedMetersPerSecond * safeDeltaSeconds;
    const movementDistanceMeters = isFollowing
      ? Math.min(
          requestedDistanceMeters,
          remainingDistanceMeters - this.followStoppingDistanceMeters,
        )
      : this.intent === "clickToPoint"
        ? Math.min(requestedDistanceMeters, remainingDistanceMeters)
        : requestedDistanceMeters;

    this.candidate.x =
      this.position.x + this.direction.x * movementDistanceMeters;
    this.candidate.z =
      this.position.z + this.direction.z * movementDistanceMeters;
    setPoint(this.facing, this.direction);

    if (
      isBlocked(
        collisionSource,
        this.candidate,
        this.radiusMeters,
        this.arenaHalfSizeMeters,
      )
    ) {
      this.blocked = true;

      if (this.intent === "clickToPoint" && !isPointerSteering) {
        this.intent = "idle";
        this.hasTarget = false;
        this.state.isClickTargetConfirmed = false;
      }

      this.finishStep(safeDeltaSeconds);
      return;
    }

    setPoint(this.position, this.candidate);
    this.blocked = false;

    if (
      !isPointerSteering &&
      this.intent === "clickToPoint" &&
      remainingDistanceMeters <= requestedDistanceMeters
    ) {
      setPoint(this.position, destination);
      this.hasTarget = false;
      this.intent = "idle";
      this.state.isClickTargetConfirmed = false;
    }

    this.finishStep(safeDeltaSeconds);
  }

  getSnapshot(): MovementSnapshot {
    return this.writeSnapshot();
  }

  writePosition(output: GroundPoint): void {
    setPoint(output, this.position);
  }

  writeSnapshot(target?: MovementSnapshot): MovementSnapshot {
    const snapshot = target ?? {
      mode: this.state.mode,
      position: { x: 0, z: 0 },
      facing: { x: 0, z: 0 },
      target: null,
      followTarget: null,
      isClickTargetConfirmed: false,
      speedMetersPerSecond: 0,
    };

    snapshot.mode = this.state.mode;
    setPoint(snapshot.position, this.position);
    setPoint(snapshot.facing, this.facing);
    snapshot.target = writePoint(snapshot.target, this.state.target);
    snapshot.followTarget = writePoint(
      snapshot.followTarget,
      this.state.followTarget,
    );
    snapshot.isClickTargetConfirmed = this.state.isClickTargetConfirmed;
    snapshot.speedMetersPerSecond = this.state.speedMetersPerSecond;
    return snapshot;
  }

  private finishStep(deltaSeconds: number): void {
    const distanceX = this.position.x - this.startingPosition.x;
    const distanceZ = this.position.z - this.startingPosition.z;
    this.state.speedMetersPerSecond =
      deltaSeconds > 0 ? Math.hypot(distanceX, distanceZ) / deltaSeconds : 0;
    this.syncState();
  }

  private syncState(): void {
    this.state.mode = this.blocked
      ? "blocked"
      : this.intent === "idle" && this.hasFollowTarget
        ? "followTarget"
        : this.intent;
    this.state.target = this.hasTarget ? this.targetPoint : null;
    this.state.followTarget = this.hasFollowTarget
      ? this.followTargetPoint
      : null;
  }
}
