import type {
  PublishAreaPresenceLogInput,
  PublishDamageLogInput,
} from "../gameLog";

export type GameEvent =
  | { type: "damage"; payload: PublishDamageLogInput }
  | { type: "area-presence"; payload: PublishAreaPresenceLogInput }
  | { type: "vitality-change"; receiverId: string; healthDelta: number }
  | { type: "target-selected" }
  | { type: "target-deselected" }
  | { type: "critical-ui-change" };
