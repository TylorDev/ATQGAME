import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useClearGameLog,
  useGameLogReader,
  useGameLogSnapshot,
  useHasGameLogEntries,
} from "@/contexts/GameLogContext";
import {
  formatGameLogEntry,
  formatGameLogMessage,
  formatLogTime,
  getGameLogKindLabel,
  MAX_GAME_LOG_ENTRIES,
  type GameLogEntry,
} from "@/game/gameLog";
import {
  createFrozenGameLogView,
  getFrozenViewNewEntryCount,
  isFrozenViewCurrent,
  type FrozenGameLogView,
} from "@/game/gameLogView";
import {
  ConsoleGestureController,
  type ConsoleFrameScheduler,
} from "@/game/consoleInteraction";
import { parseGameConsoleCommand } from "@/game/consoleCommand";
import { GAME_CONSOLE_KEYBINDING } from "@/game/keybindings";
import {
  loadConsoleWindowState,
  normalizeConsoleWindowState,
  saveConsoleWindowState,
  type ConsoleResizeDirection,
  type ConsoleWindowState,
} from "@/game/consoleWindow";
import styles from "./GameConsole.module.scss";

const resizeDirections: readonly ConsoleResizeDirection[] = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
];
const scrollBottomThresholdPx = 24;
const clearConfirmationDurationMs = 3_000;
const viewportPersistenceDelayMs = 180;
const virtualRowEstimatePx = 36;
const virtualRowOverscan = 8;
const eventCountFormatter = new Intl.NumberFormat("es-ES");

const browserFrameScheduler: ConsoleFrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (frameId) => window.cancelAnimationFrame(frameId),
};

function getViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function getInitialWindowState(): ConsoleWindowState {
  return loadConsoleWindowState(window.localStorage, getViewport());
}

function stopActionPointerDown(event: ReactPointerEvent<HTMLButtonElement>): void {
  event.stopPropagation();
}

function applyWindowPreview(
  element: HTMLElement | null,
  state: ConsoleWindowState,
  initialState: ConsoleWindowState,
): void {
  if (!element) {
    return;
  }

  element.style.width = `${state.width}px`;
  element.style.height = `${state.height}px`;
  element.style.transform = `translate3d(${state.x - initialState.x}px, ${
    state.y - initialState.y
  }px, 0)`;
  element.style.willChange = "transform, width, height";
}

function applyCommittedWindowState(
  element: HTMLElement | null,
  state: ConsoleWindowState,
): void {
  if (!element) {
    return;
  }

  element.style.left = `${state.x}px`;
  element.style.top = `${state.y}px`;
  element.style.width = `${state.width}px`;
  element.style.height = `${state.height}px`;
  element.style.transform = "";
  element.style.willChange = "";
}

interface GameLogRowProps {
  entry: GameLogEntry;
  index: number;
  measureElement: (element: HTMLLIElement | null) => void;
}

const GameLogRow = memo(function GameLogRow({
  entry,
  index,
  measureElement,
}: GameLogRowProps) {
  return (
    <li
      aria-label={formatGameLogEntry(entry)}
      className={styles.entry}
      data-index={index}
      ref={measureElement}
    >
      <time
        className={styles.time}
        dateTime={new Date(entry.occurredAtMs).toISOString()}
      >
        {formatLogTime(entry.occurredAtMs)}
      </time>
      <span className={styles.kind}>{getGameLogKindLabel(entry)}</span>
      <span className={styles.message}>{formatGameLogMessage(entry)}</span>
    </li>
  );
});

const GameConsoleHeader = memo(function GameConsoleHeader({
  onHide,
  onMoveStart,
}: {
  onHide: () => void;
  onMoveStart: (event: ReactPointerEvent<HTMLElement>) => void;
}) {
  const hasEntries = useHasGameLogEntries();
  const clearEntries = useClearGameLog();
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isClearPending, setIsClearPending] = useState(false);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  const handleClear = (): void => {
    if (!isClearPending) {
      setIsClearPending(true);
      clearTimerRef.current = setTimeout(() => {
        setIsClearPending(false);
        clearTimerRef.current = null;
      }, clearConfirmationDurationMs);
      return;
    }

    if (clearTimerRef.current !== null) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    clearEntries();
    setIsClearPending(false);
  };

  return (
    <header className={styles.header} onPointerDown={onMoveStart}>
      <div className={styles.identity}>
        <span className={styles.live} aria-hidden="true" />
        <div>
          <span className={styles.eyebrow}>Registro global · En vivo</span>
          <h2 className={styles.title} id="game-console-title">
            Consola del mapa
          </h2>
        </div>
      </div>

      <div className={styles.actions}>
        <button
          className={isClearPending ? styles.confirm : styles.action}
          disabled={!hasEntries}
          onClick={handleClear}
          onPointerDown={stopActionPointerDown}
          type="button"
        >
          {isClearPending ? "Confirmar" : "Limpiar"}
        </button>
        <button
          aria-label={`Ocultar consola (${GAME_CONSOLE_KEYBINDING.input})`}
          className={styles.hide}
          onClick={onHide}
          onPointerDown={stopActionPointerDown}
          title={`Ocultar · ${GAME_CONSOLE_KEYBINDING.input}`}
          type="button"
        >
          —
        </button>
      </div>
    </header>
  );
});

interface GameConsoleCommandLineProps {
  fpsVisible: boolean;
  onFpsVisibilityChange: (visible: boolean) => void;
}

const GameConsoleCommandLine = memo(function GameConsoleCommandLine({
  fpsVisible,
  onFpsVisibilityChange,
}: GameConsoleCommandLineProps) {
  const [commandText, setCommandText] = useState("");
  const [feedback, setFeedback] = useState("Comando disponible: /fps");
  const [hasError, setHasError] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const command = parseGameConsoleCommand(commandText);

    if (command.type === "empty") {
      return;
    }

    setCommandText("");

    if (command.type === "toggle-fps") {
      const nextVisible = !fpsVisible;
      onFpsVisibilityChange(nextVisible);
      setHasError(false);
      setFeedback(
        `Contador FPS ${nextVisible ? "activado" : "desactivado"}.`,
      );
      return;
    }

    setHasError(true);
    setFeedback(`Comando no reconocido: ${command.input}`);
  };

  return (
    <footer className={styles.commandArea}>
      <form className={styles.commandForm} onSubmit={handleSubmit}>
        <label className={styles.commandPrompt} htmlFor="game-console-command">
          &gt;
        </label>
        <input
          aria-label="Comando de consola"
          autoCapitalize="none"
          autoComplete="off"
          className={styles.commandInput}
          id="game-console-command"
          onChange={(event) => setCommandText(event.target.value)}
          placeholder="/fps"
          spellCheck={false}
          value={commandText}
        />
        <button className={styles.commandSubmit} type="submit">
          Ejecutar
        </button>
      </form>
      <p
        aria-live="polite"
        className={hasError ? styles.commandError : styles.commandFeedback}
      >
        {feedback}
      </p>
    </footer>
  );
});

const GameConsoleFeed = memo(function GameConsoleFeed() {
  const latestSnapshot = useGameLogSnapshot();
  const { getEntry: getLatestEntry, readEntries } = useGameLogReader();
  const feedRef = useRef<HTMLDivElement>(null);
  const isFollowingRef = useRef(true);
  const automaticScrollFrameRef = useRef<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(true);
  const [frozenView, setFrozenView] = useState<FrozenGameLogView | null>(null);
  const frozenViewIsCurrent =
    frozenView !== null && isFrozenViewCurrent(latestSnapshot, frozenView);
  const useFrozenView = !isFollowing && frozenViewIsCurrent;
  const viewCount = useFrozenView
    ? frozenView.entries.length
    : latestSnapshot.count;

  const getViewEntry = useCallback(
    (index: number): GameLogEntry | undefined =>
      useFrozenView ? frozenView.entries[index] : getLatestEntry(index),
    [frozenView, getLatestEntry, useFrozenView],
  );
  const getItemKey = useCallback(
    (index: number) =>
      getViewEntry(index)?.id ??
      `missing-${latestSnapshot.generation}-${latestSnapshot.revision}-${index}`,
    [getViewEntry, latestSnapshot.generation, latestSnapshot.revision],
  );
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLLIElement>({
    count: viewCount,
    getScrollElement: () => feedRef.current,
    estimateSize: () => virtualRowEstimatePx,
    getItemKey,
    overscan: virtualRowOverscan,
    paddingStart: 8,
    paddingEnd: 8,
    directDomUpdates: true,
    directDomUpdatesMode: "transform",
    useFlushSync: false,
    useAnimationFrameWithResizeObserver: true,
    anchorTo: "end",
    followOnAppend: isFollowing ? "instant" : false,
  });

  const scheduleAutomaticScrollToEnd = useCallback((): void => {
    if (automaticScrollFrameRef.current !== null) {
      cancelAnimationFrame(automaticScrollFrameRef.current);
    }

    automaticScrollFrameRef.current = requestAnimationFrame(() => {
      automaticScrollFrameRef.current = null;
      rowVirtualizer.scrollToEnd();
    });
  }, [rowVirtualizer]);

  const scrollToLatest = useCallback((): void => {
    isFollowingRef.current = true;
    setIsFollowing(true);
    setFrozenView(null);

    if (latestSnapshot.count > 0) {
      scheduleAutomaticScrollToEnd();
    }
  }, [latestSnapshot.count, scheduleAutomaticScrollToEnd]);

  useLayoutEffect(() => {
    if (frozenView && !frozenViewIsCurrent) {
      isFollowingRef.current = true;
      setIsFollowing(true);
      setFrozenView(null);
    }

    if (isFollowingRef.current && latestSnapshot.count > 0) {
      scheduleAutomaticScrollToEnd();
    }
  }, [
    frozenView,
    frozenViewIsCurrent,
    latestSnapshot.count,
    latestSnapshot.revision,
    scheduleAutomaticScrollToEnd,
  ]);

  useEffect(() => {
    return () => {
      if (automaticScrollFrameRef.current !== null) {
        cancelAnimationFrame(automaticScrollFrameRef.current);
      }
    };
  }, []);

  const handleFeedScroll = (): void => {
    if (automaticScrollFrameRef.current !== null) {
      return;
    }

    const isAtBottom = rowVirtualizer.isAtEnd(scrollBottomThresholdPx);

    if (!isAtBottom && isFollowingRef.current) {
      isFollowingRef.current = false;
      setFrozenView(
        createFrozenGameLogView(latestSnapshot, readEntries()),
      );
      setIsFollowing(false);
      return;
    }

    if (isAtBottom && !isFollowingRef.current) {
      scrollToLatest();
    }
  };

  const newEntryCount =
    frozenView && frozenViewIsCurrent
      ? getFrozenViewNewEntryCount(latestSnapshot, frozenView)
      : 0;

  return (
    <div className={styles.body}>
      <div className={styles.retention}>
        <span>Últimos {eventCountFormatter.format(MAX_GAME_LOG_ENTRIES)} eventos</span>
        {latestSnapshot.discardedCount > 0 ? (
          <span>
            {eventCountFormatter.format(latestSnapshot.discardedCount)} antiguos descartados
          </span>
        ) : null}
      </div>

      <div
        aria-live="polite"
        aria-relevant="additions"
        className={styles.feed}
        onScroll={handleFeedScroll}
        ref={feedRef}
        role="log"
      >
        {viewCount === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyCode}>SIN EVENTOS</span>
            <p>Los eventos de daño y área del mapa aparecerán aquí.</p>
          </div>
        ) : (
          <ol className={styles.list} ref={rowVirtualizer.containerRef}>
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const entry = getViewEntry(virtualRow.index);

              return entry ? (
                <GameLogRow
                  entry={entry}
                  index={virtualRow.index}
                  key={entry.id}
                  measureElement={rowVirtualizer.measureElement}
                />
              ) : null;
            })}
          </ol>
        )}
      </div>

      {newEntryCount > 0 ? (
        <button className={styles.newEntries} onClick={scrollToLatest} type="button">
          {eventCountFormatter.format(newEntryCount)}{" "}
          {newEntryCount === 1 ? "evento nuevo" : "eventos nuevos"} ↓
        </button>
      ) : null}
    </div>
  );
});

function GameConsoleWindow({
  state,
  windowRef,
  fpsVisible,
  onFpsVisibilityChange,
  onHide,
  onMoveStart,
  onResizeStart,
}: {
  state: ConsoleWindowState;
  windowRef: RefObject<HTMLElement | null>;
  fpsVisible: boolean;
  onFpsVisibilityChange: (visible: boolean) => void;
  onHide: () => void;
  onMoveStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (
    direction: ConsoleResizeDirection,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
}) {
  return (
    <section
      aria-labelledby="game-console-title"
      className={styles.window}
      ref={windowRef}
      style={{
        left: state.x,
        top: state.y,
        width: state.width,
        height: state.height,
      }}
    >
      <GameConsoleHeader onHide={onHide} onMoveStart={onMoveStart} />
      <GameConsoleFeed />
      <GameConsoleCommandLine
        fpsVisible={fpsVisible}
        onFpsVisibilityChange={onFpsVisibilityChange}
      />

      {resizeDirections.map((direction) => (
        <div
          aria-hidden="true"
          className={`${styles.handle} ${styles[direction]}`}
          key={direction}
          onPointerDown={(event) => onResizeStart(direction, event)}
        />
      ))}
    </section>
  );
}

interface GameConsoleProps {
  fpsVisible: boolean;
  onFpsVisibilityChange: (visible: boolean) => void;
}

export function GameConsole({
  fpsVisible,
  onFpsVisibilityChange,
}: GameConsoleProps) {
  const [windowState, setWindowState] =
    useState<ConsoleWindowState>(getInitialWindowState);
  const windowStateRef = useRef(windowState);
  const windowRef = useRef<HTMLElement>(null);

  const commitWindowState = useCallback((nextState: ConsoleWindowState): void => {
    windowStateRef.current = nextState;
    applyCommittedWindowState(windowRef.current, nextState);
    setWindowState(nextState);
    saveConsoleWindowState(window.localStorage, nextState, getViewport());
  }, []);

  const gestureController = useMemo(
    () =>
      new ConsoleGestureController({
        scheduler: browserFrameScheduler,
        getViewport,
        onPreview: (state, initialState) =>
          applyWindowPreview(windowRef.current, state, initialState),
        onCommit: commitWindowState,
      }),
    [commitWindowState],
  );

  useEffect(() => {
    const toggleConsole = (): void => {
      gestureController.finishActive();
      const currentState = windowStateRef.current;
      commitWindowState({ ...currentState, isOpen: !currentState.isOpen });
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.code !== GAME_CONSOLE_KEYBINDING.code || event.repeat) {
        return;
      }

      event.preventDefault();
      toggleConsole();
    };
    const handlePointerMove = (event: PointerEvent): void => {
      gestureController.update(
        event.pointerId,
        event.clientX,
        event.clientY,
      );
    };
    const finishPointerInteraction = (event: PointerEvent): void => {
      gestureController.finish(event.pointerId, event.clientX, event.clientY);
    };
    const finishActiveInteraction = (): void => {
      gestureController.finishActive();
    };
    const handleVisibilityChange = (): void => {
      if (document.hidden) {
        finishActiveInteraction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", finishPointerInteraction);
    window.addEventListener("pointercancel", finishPointerInteraction);
    window.addEventListener("lostpointercapture", finishPointerInteraction);
    window.addEventListener("blur", finishActiveInteraction);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", finishPointerInteraction);
      window.removeEventListener("pointercancel", finishPointerInteraction);
      window.removeEventListener("lostpointercapture", finishPointerInteraction);
      window.removeEventListener("blur", finishActiveInteraction);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      const finalState = gestureController.finishActive(false);

      if (finalState) {
        windowStateRef.current = finalState;
        saveConsoleWindowState(window.localStorage, finalState, getViewport());
      }

      gestureController.dispose();
    };
  }, [commitWindowState, gestureController]);

  useEffect(() => {
    let pendingFrameId: number | null = null;
    let persistenceTimerId: ReturnType<typeof setTimeout> | null = null;
    let pendingState: ConsoleWindowState | null = null;

    const handleResize = (): void => {
      gestureController.finishActive();

      if (pendingFrameId !== null) {
        return;
      }

      pendingFrameId = requestAnimationFrame(() => {
        pendingFrameId = null;
        pendingState = normalizeConsoleWindowState(
          windowStateRef.current,
          getViewport(),
        );
        applyCommittedWindowState(windowRef.current, pendingState);

        if (persistenceTimerId !== null) {
          clearTimeout(persistenceTimerId);
        }

        persistenceTimerId = setTimeout(() => {
          if (pendingState) {
            commitWindowState(pendingState);
            pendingState = null;
          }

          persistenceTimerId = null;
        }, viewportPersistenceDelayMs);
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      if (pendingFrameId !== null) {
        cancelAnimationFrame(pendingFrameId);
      }

      if (persistenceTimerId !== null) {
        clearTimeout(persistenceTimerId);
      }

      if (pendingState) {
        saveConsoleWindowState(window.localStorage, pendingState, getViewport());
      }
    };
  }, [commitWindowState, gestureController]);

  const beginInteraction = useCallback(
    (
      event: ReactPointerEvent<HTMLElement>,
      resizeDirection: ConsoleResizeDirection | null,
    ): void => {
      if (event.button !== 0) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gestureController.finishActive();
      gestureController.begin({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        initialState: windowStateRef.current,
        resizeDirection,
      });
    },
    [gestureController],
  );

  const handleMoveStart = useCallback(
    (event: ReactPointerEvent<HTMLElement>): void => {
      beginInteraction(event, null);
    },
    [beginInteraction],
  );

  const handleResizeStart = useCallback(
    (
      direction: ConsoleResizeDirection,
      event: ReactPointerEvent<HTMLDivElement>,
    ): void => {
      beginInteraction(event, direction);
    },
    [beginInteraction],
  );

  const hideConsole = useCallback((): void => {
    gestureController.finishActive();
    commitWindowState({ ...windowStateRef.current, isOpen: false });
  }, [commitWindowState, gestureController]);

  return windowState.isOpen ? (
    <GameConsoleWindow
      state={windowState}
      windowRef={windowRef}
      fpsVisible={fpsVisible}
      onFpsVisibilityChange={onFpsVisibilityChange}
      onHide={hideConsole}
      onMoveStart={handleMoveStart}
      onResizeStart={handleResizeStart}
    />
  ) : null;
}
