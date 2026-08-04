import {
  moveConsoleWindow,
  resizeConsoleWindow,
  type ConsoleResizeDirection,
  type ConsoleViewport,
  type ConsoleWindowState,
} from "./consoleWindow";

export interface ConsoleFrameScheduler {
  request: (callback: () => void) => number;
  cancel: (frameId: number) => void;
}

export interface ConsoleGestureStart {
  pointerId: number;
  clientX: number;
  clientY: number;
  initialState: ConsoleWindowState;
  resizeDirection: ConsoleResizeDirection | null;
}

interface ActiveConsoleGesture extends ConsoleGestureStart {
  latestClientX: number;
  latestClientY: number;
}

interface ConsoleGestureControllerOptions {
  scheduler: ConsoleFrameScheduler;
  getViewport: () => ConsoleViewport;
  onPreview: (
    state: ConsoleWindowState,
    initialState: ConsoleWindowState,
  ) => void;
  onCommit: (state: ConsoleWindowState) => void;
}

export class ConsoleGestureController {
  private activeGesture: ActiveConsoleGesture | null = null;
  private pendingFrameId: number | null = null;

  constructor(private readonly options: ConsoleGestureControllerOptions) {}

  begin(start: ConsoleGestureStart): void {
    this.dispose();
    this.activeGesture = {
      ...start,
      latestClientX: start.clientX,
      latestClientY: start.clientY,
    };
  }

  update(pointerId: number, clientX: number, clientY: number): void {
    const gesture = this.activeGesture;

    if (!gesture || gesture.pointerId !== pointerId) {
      return;
    }

    gesture.latestClientX = clientX;
    gesture.latestClientY = clientY;

    if (this.pendingFrameId !== null) {
      return;
    }

    this.pendingFrameId = this.options.scheduler.request(() => {
      this.pendingFrameId = null;
      this.previewCurrentGesture();
    });
  }

  finish(
    pointerId: number,
    clientX?: number,
    clientY?: number,
    shouldCommit = true,
  ): ConsoleWindowState | null {
    const gesture = this.activeGesture;

    if (!gesture || gesture.pointerId !== pointerId) {
      return null;
    }

    if (typeof clientX === "number") {
      gesture.latestClientX = clientX;
    }

    if (typeof clientY === "number") {
      gesture.latestClientY = clientY;
    }

    this.cancelPendingFrame();
    const finalState = this.calculateState(gesture);
    this.options.onPreview(finalState, gesture.initialState);
    this.activeGesture = null;

    if (shouldCommit) {
      this.options.onCommit(finalState);
    }

    return finalState;
  }

  finishActive(shouldCommit = true): ConsoleWindowState | null {
    const gesture = this.activeGesture;
    return gesture
      ? this.finish(gesture.pointerId, undefined, undefined, shouldCommit)
      : null;
  }

  dispose(): void {
    this.cancelPendingFrame();
    this.activeGesture = null;
  }

  private previewCurrentGesture(): void {
    const gesture = this.activeGesture;

    if (!gesture) {
      return;
    }

    this.options.onPreview(
      this.calculateState(gesture),
      gesture.initialState,
    );
  }

  private calculateState(gesture: ActiveConsoleGesture): ConsoleWindowState {
    const deltaX = gesture.latestClientX - gesture.clientX;
    const deltaY = gesture.latestClientY - gesture.clientY;
    const viewport = this.options.getViewport();

    return gesture.resizeDirection
      ? resizeConsoleWindow(
          gesture.initialState,
          gesture.resizeDirection,
          deltaX,
          deltaY,
          viewport,
        )
      : moveConsoleWindow(
          gesture.initialState,
          deltaX,
          deltaY,
          viewport,
        );
  }

  private cancelPendingFrame(): void {
    if (this.pendingFrameId === null) {
      return;
    }

    this.options.scheduler.cancel(this.pendingFrameId);
    this.pendingFrameId = null;
  }
}
