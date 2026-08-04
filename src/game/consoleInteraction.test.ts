import { describe, expect, it, vi } from "vitest";
import {
  ConsoleGestureController,
  type ConsoleFrameScheduler,
} from "./consoleInteraction";

function createFakeScheduler() {
  let nextId = 1;
  const callbacks = new Map<number, () => void>();
  const scheduler: ConsoleFrameScheduler = {
    request: (callback) => {
      const id = nextId;
      nextId += 1;
      callbacks.set(id, callback);
      return id;
    },
    cancel: (id) => {
      callbacks.delete(id);
    },
  };

  return {
    scheduler,
    pendingCount: () => callbacks.size,
    flush: () => {
      const pending = [...callbacks.values()];
      callbacks.clear();
      pending.forEach((callback) => callback());
    },
  };
}

const initialState = {
  x: 100,
  y: 100,
  width: 560,
  height: 260,
  isOpen: true,
};

describe("ConsoleGestureController", () => {
  it("coalesces many pointer updates into one preview per animation frame", () => {
    const fake = createFakeScheduler();
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const controller = new ConsoleGestureController({
      scheduler: fake.scheduler,
      getViewport: () => ({ width: 1_200, height: 800 }),
      onPreview,
      onCommit,
    });

    controller.begin({
      pointerId: 7,
      clientX: 10,
      clientY: 20,
      initialState,
      resizeDirection: null,
    });

    for (let index = 1; index <= 100; index += 1) {
      controller.update(7, 10 + index, 20 + index);
    }

    expect(fake.pendingCount()).toBe(1);
    expect(onPreview).not.toHaveBeenCalled();

    fake.flush();

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview).toHaveBeenLastCalledWith(
      { ...initialState, x: 200, y: 200 },
      initialState,
    );
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("flushes the final coordinates and commits exactly once", () => {
    const fake = createFakeScheduler();
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const controller = new ConsoleGestureController({
      scheduler: fake.scheduler,
      getViewport: () => ({ width: 1_200, height: 800 }),
      onPreview,
      onCommit,
    });

    controller.begin({
      pointerId: 3,
      clientX: 100,
      clientY: 100,
      initialState,
      resizeDirection: "se",
    });
    controller.update(3, 120, 130);
    controller.finish(3, 140, 150);

    expect(fake.pendingCount()).toBe(0);
    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      ...initialState,
      width: 600,
      height: 310,
    });
  });

  it("cancels pending work on disposal without committing", () => {
    const fake = createFakeScheduler();
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const controller = new ConsoleGestureController({
      scheduler: fake.scheduler,
      getViewport: () => ({ width: 1_200, height: 800 }),
      onPreview,
      onCommit,
    });

    controller.begin({
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      initialState,
      resizeDirection: null,
    });
    controller.update(1, 50, 50);
    controller.dispose();
    fake.flush();

    expect(onPreview).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("can finalize for unmount persistence without invoking the React commit", () => {
    const fake = createFakeScheduler();
    const onPreview = vi.fn();
    const onCommit = vi.fn();
    const controller = new ConsoleGestureController({
      scheduler: fake.scheduler,
      getViewport: () => ({ width: 1_200, height: 800 }),
      onPreview,
      onCommit,
    });

    controller.begin({
      pointerId: 9,
      clientX: 0,
      clientY: 0,
      initialState,
      resizeDirection: null,
    });
    controller.update(9, 25, 30);

    expect(controller.finishActive(false)).toEqual({
      ...initialState,
      x: 125,
      y: 130,
    });
    expect(onCommit).not.toHaveBeenCalled();
  });
});
