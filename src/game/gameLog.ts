export type DamageLogActorKind =
  | "player"
  | "enemy"
  | "entity"
  | "test-dummy";

export interface DamageLogActor {
  id: string;
  kind: DamageLogActorKind;
  displayName: string;
}

export interface DamageLogEntry {
  id: string;
  type: "damage";
  occurredAtMs: number;
  receiver: DamageLogActor;
  source: DamageLogActor;
  appliedDamage: number;
}

export interface PublishDamageLogInput {
  occurredAtMs?: number;
  receiver: DamageLogActor;
  source: DamageLogActor;
  appliedDamage: number;
}

export type AreaPresenceStatus = "inside" | "outside" | "deactivated";

export interface AreaPresenceLogEntry {
  id: string;
  type: "area-presence";
  occurredAtMs: number;
  target: DamageLogActor;
  status: AreaPresenceStatus;
  areaRadiusMeters: number;
}

export interface PublishAreaPresenceLogInput {
  occurredAtMs?: number;
  target: DamageLogActor;
  status: AreaPresenceStatus;
  areaRadiusMeters: number;
}

export type GameLogEntry = DamageLogEntry | AreaPresenceLogEntry;

export interface GameLogSnapshot {
  revision: number;
  count: number;
  publishedCount: number;
  discardedCount: number;
  generation: number;
}

export interface GameLogStore {
  getSnapshot: () => GameLogSnapshot;
  getHasEntriesSnapshot: () => boolean;
  getEntry: (index: number) => GameLogEntry | undefined;
  readEntries: () => readonly GameLogEntry[];
  subscribe: (listener: () => void) => () => void;
  publishDamage: (input: PublishDamageLogInput) => DamageLogEntry | null;
  publishAreaPresence: (
    input: PublishAreaPresenceLogInput,
  ) => AreaPresenceLogEntry | null;
  clear: () => void;
}

export const MAX_GAME_LOG_ENTRIES = 2_000;

const actorKindLabels: Record<Exclude<DamageLogActorKind, "test-dummy">, string> = {
  player: "Jugador",
  enemy: "Enemigo",
  entity: "Entidad",
};

const damageNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

const radiusNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
});

function formatActor(actor: DamageLogActor): string {
  if (actor.kind === "test-dummy") {
    return actor.displayName;
  }

  return `${actorKindLabels[actor.kind]} "${actor.displayName}"`;
}

export function formatLogTime(occurredAtMs: number): string {
  const date = new Date(occurredAtMs);

  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

export function formatDamageLogMessage(entry: DamageLogEntry): string {
  return `${formatActor(entry.receiver)} recibió ${damageNumberFormatter.format(
    entry.appliedDamage,
  )} de daño de ${formatActor(entry.source)}.`;
}

export function formatDamageLogEntry(entry: DamageLogEntry): string {
  return `${formatLogTime(entry.occurredAtMs)} DAÑO · ${formatDamageLogMessage(entry)}`;
}

export function formatAreaPresenceLogMessage(
  entry: AreaPresenceLogEntry,
): string {
  const radius = radiusNumberFormatter.format(entry.areaRadiusMeters);

  if (entry.status === "deactivated") {
    return `Área de ${radius} m desactivada.`;
  }

  const state = entry.status === "inside" ? "DENTRO" : "FUERA";
  return `${entry.target.displayName} está ${state} del área de ${radius} m.`;
}

export function getGameLogKindLabel(entry: GameLogEntry): string {
  return entry.type === "damage" ? "Daño" : "Área";
}

export function formatGameLogMessage(entry: GameLogEntry): string {
  return entry.type === "damage"
    ? formatDamageLogMessage(entry)
    : formatAreaPresenceLogMessage(entry);
}

export function formatGameLogEntry(entry: GameLogEntry): string {
  return `${formatLogTime(entry.occurredAtMs)} ${getGameLogKindLabel(entry).toUpperCase()} · ${formatGameLogMessage(entry)}`;
}

export function createGameLogStore(
  capacity = MAX_GAME_LOG_ENTRIES,
): GameLogStore {
  const normalizedCapacity = Number.isInteger(capacity) && capacity > 0
    ? capacity
    : MAX_GAME_LOG_ENTRIES;
  const buffer = new Array<GameLogEntry | undefined>(normalizedCapacity);
  let startIndex = 0;
  let size = 0;
  let nextSequence = 1;
  let snapshot: GameLogSnapshot = {
    revision: 0,
    count: 0,
    publishedCount: 0,
    discardedCount: 0,
    generation: 0,
  };
  const listeners = new Set<() => void>();

  const notify = (): void => {
    listeners.forEach((listener) => listener());
  };

  const appendEntry = <Entry extends GameLogEntry>(entry: Entry): Entry => {
    nextSequence += 1;
    const didDiscardOldest = size === normalizedCapacity;

    if (!didDiscardOldest) {
      buffer[(startIndex + size) % normalizedCapacity] = entry;
      size += 1;
    } else {
      buffer[startIndex] = entry;
      startIndex = (startIndex + 1) % normalizedCapacity;
    }

    snapshot = {
      ...snapshot,
      revision: snapshot.revision + 1,
      count: size,
      publishedCount: snapshot.publishedCount + 1,
      discardedCount:
        snapshot.discardedCount + (didDiscardOldest ? 1 : 0),
    };
    notify();

    return entry;
  };

  return {
    getSnapshot: () => snapshot,
    getHasEntriesSnapshot: () => snapshot.count > 0,
    getEntry: (index) => {
      if (!Number.isInteger(index) || index < 0 || index >= size) {
        return undefined;
      }

      return buffer[(startIndex + index) % normalizedCapacity];
    },
    readEntries: () => {
      const entries = new Array<GameLogEntry>(size);

      for (let index = 0; index < size; index += 1) {
        const entry = buffer[(startIndex + index) % normalizedCapacity];

        if (entry) {
          entries[index] = entry;
        }
      }

      return entries;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publishDamage: (input) => {
      if (!Number.isFinite(input.appliedDamage) || input.appliedDamage <= 0) {
        return null;
      }

      const occurredAtMs = Number.isFinite(input.occurredAtMs)
        ? (input.occurredAtMs as number)
        : Date.now();
      const entry: DamageLogEntry = {
        id: `damage-${occurredAtMs}-${nextSequence}`,
        type: "damage",
        occurredAtMs,
        receiver: { ...input.receiver },
        source: { ...input.source },
        appliedDamage: input.appliedDamage,
      };

      return appendEntry(entry);
    },
    publishAreaPresence: (input) => {
      if (
        !Number.isFinite(input.areaRadiusMeters) ||
        input.areaRadiusMeters <= 0
      ) {
        return null;
      }

      const occurredAtMs = Number.isFinite(input.occurredAtMs)
        ? (input.occurredAtMs as number)
        : Date.now();
      const entry: AreaPresenceLogEntry = {
        id: `area-presence-${occurredAtMs}-${nextSequence}`,
        type: "area-presence",
        occurredAtMs,
        target: { ...input.target },
        status: input.status,
        areaRadiusMeters: input.areaRadiusMeters,
      };

      return appendEntry(entry);
    },
    clear: () => {
      if (size === 0 && snapshot.discardedCount === 0) {
        return;
      }

      buffer.fill(undefined);
      startIndex = 0;
      size = 0;
      snapshot = {
        revision: snapshot.revision + 1,
        count: 0,
        publishedCount: 0,
        discardedCount: 0,
        generation: snapshot.generation + 1,
      };
      notify();
    },
  };
}
