import type { HandlerRegistry } from "../types.js";
import { gameHandlers } from "./game.js";
import { combatHandlers } from "./combat.js";
import { chatHandlers } from "./chat.js";
import { dmHandlers } from "./dm.js";
import { inventoryHandlers } from "./inventory.js";

/**
 * The complete client -> server message routing table, assembled from the
 * per-domain handler modules. Adding a message type means adding it to one
 * module; the manager itself never changes.
 */
export const messageHandlers: HandlerRegistry = {
  ...gameHandlers,
  ...combatHandlers,
  ...chatHandlers,
  ...dmHandlers,
  ...inventoryHandlers,
};
