import { describe, expect, it } from "vitest";
import {
  CONSOLE_WINDOW_MARGIN_PX,
  CONSOLE_WINDOW_STORAGE_KEY,
  getDefaultConsoleWindowState,
  loadConsoleWindowState,
  moveConsoleWindow,
  normalizeConsoleWindowState,
  resizeConsoleWindow,
  saveConsoleWindowState,
  type ConsoleResizeDirection,
} from "./consoleWindow";

const viewport = { width: 1_200, height: 800 };

describe("console window geometry", () => {
  it("starts open at the bottom-left with the planned dimensions", () => {
    expect(getDefaultConsoleWindowState(viewport)).toEqual({
      x: 16,
      y: 524,
      width: 560,
      height: 260,
      isOpen: true,
    });
  });

  it("keeps moved and restored windows inside the viewport", () => {
    const initial = getDefaultConsoleWindowState(viewport);
    const moved = moveConsoleWindow(initial, 2_000, -2_000, viewport);

    expect(moved.x + moved.width).toBe(
      viewport.width - CONSOLE_WINDOW_MARGIN_PX,
    );
    expect(moved.y).toBe(CONSOLE_WINDOW_MARGIN_PX);

    expect(
      normalizeConsoleWindowState(
        { x: -500, y: 900, width: 5_000, height: 20, isOpen: false },
        viewport,
      ),
    ).toEqual({ x: 16, y: 604, width: 1168, height: 180, isOpen: false });
  });

  it.each<ConsoleResizeDirection>(["n", "ne", "e", "se", "s", "sw", "w", "nw"])(
    "resizes from the %s handle without leaving the viewport",
    (direction) => {
      const resized = resizeConsoleWindow(
        { x: 300, y: 250, width: 500, height: 300, isOpen: true },
        direction,
        direction.includes("w") ? -50 : 50,
        direction.includes("n") ? -40 : 40,
        viewport,
      );

      expect(resized.x).toBeGreaterThanOrEqual(CONSOLE_WINDOW_MARGIN_PX);
      expect(resized.y).toBeGreaterThanOrEqual(CONSOLE_WINDOW_MARGIN_PX);
      expect(resized.x + resized.width).toBeLessThanOrEqual(
        viewport.width - CONSOLE_WINDOW_MARGIN_PX,
      );
      expect(resized.y + resized.height).toBeLessThanOrEqual(
        viewport.height - CONSOLE_WINDOW_MARGIN_PX,
      );

      if (direction.includes("w")) {
        expect(resized.x).toBe(250);
      } else {
        expect(resized.x).toBe(300);
      }

      if (direction.includes("e")) {
        expect(resized.x + resized.width).toBe(850);
      } else {
        expect(resized.x + resized.width).toBe(800);
      }

      if (direction.includes("n")) {
        expect(resized.y).toBe(210);
      } else {
        expect(resized.y).toBe(250);
      }

      if (direction.includes("s")) {
        expect(resized.y + resized.height).toBe(590);
      } else {
        expect(resized.y + resized.height).toBe(550);
      }
    },
  );

  it("shrinks its nominal minimums to fit a narrow viewport", () => {
    expect(getDefaultConsoleWindowState({ width: 320, height: 480 })).toEqual({
      x: 16,
      y: 204,
      width: 288,
      height: 260,
      isOpen: true,
    });
  });

  it("persists visibility and normalized geometry in versioned storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const state = { x: 40, y: 50, width: 640, height: 320, isOpen: false };

    saveConsoleWindowState(storage, state, viewport);

    expect(values.has(CONSOLE_WINDOW_STORAGE_KEY)).toBe(true);
    expect(loadConsoleWindowState(storage, viewport)).toEqual(state);
  });
});
