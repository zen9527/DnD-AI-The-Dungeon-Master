import { log } from "../../utils/logger.js";
import { equipItemSchema, useItemSchema, itemSchema } from "../../../shared/index.js";
import { parsePayload, requireDM, requirePlayer } from "../guards.js";
import type { HandlerContext, HandlerRegistry } from "../types.js";

/** INVENTORY_ADD_ITEM — DM hands an item to the player. */
function handleInventoryAddItem(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "add items");
  if (!resolved) return;

  const itemPayload = ctx.payload.item as Record<string, unknown> | undefined;
  if (!itemPayload) {
    ctx.manager.sendError(ctx.ws, "Missing item data");
    return;
  }

  // The client may omit the id; mint one so the item is addressable for equip/use.
  const candidate = { ...itemPayload, id: (ctx.payload.itemId as string) || `item_${Date.now()}` };
  const item = parsePayload(ctx, itemSchema, candidate);
  if (!item) return;

  const playerId = ctx.client.playerId!;
  resolved.engine.addItemToInventory(playerId, item);

  ctx.manager.broadcastToGame(resolved.engine.id, "INVENTORY_UPDATE", {
    playerId,
    action: "add_item",
    item: { id: item.id, name: item.name, type: item.type },
  });

  log.info(`[Inventory] Added item ${item.name} to player ${playerId}`);
}

/** Shared body for EQUIP_WEAPON / EQUIP_ARMOR — only the slot differs. */
function equipToSlot(ctx: HandlerContext, slot: "weapon" | "armor"): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;

  const parsed = parsePayload(ctx, equipItemSchema, { itemId: ctx.payload.itemId, slot });
  if (!parsed) return;

  const playerId = ctx.client.playerId!;
  resolved.engine.equipItem(playerId, parsed.itemId, slot);

  ctx.manager.broadcastToGame(resolved.engine.id, "EQUIPMENT_UPDATE", {
    playerId,
    slot,
    itemId: parsed.itemId,
  });

  log.info(`[Equipment] Player ${playerId} equipped ${slot} ${parsed.itemId}`);
}

/** Shared body for UNEQUIP_WEAPON / UNEQUIP_ARMOR. */
function unequipSlot(ctx: HandlerContext, slot: "weapon" | "armor"): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;

  const playerId = ctx.client.playerId!;
  resolved.engine.unequipItem(playerId, slot);

  ctx.manager.broadcastToGame(resolved.engine.id, "EQUIPMENT_UPDATE", {
    playerId,
    slot,
    itemId: null,
  });

  log.info(`[Equipment] Player ${playerId} unequipped ${slot}`);
}

/** USE_ITEM — consume a potion or other consumable, optionally on a target. */
function handleUseItem(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;

  const parsed = parsePayload(ctx, useItemSchema);
  if (!parsed) return;

  const playerId = ctx.client.playerId!;
  resolved.engine.useItem(playerId, parsed.itemId, parsed.targetId);

  ctx.manager.broadcastToGame(resolved.engine.id, "ITEM_USED", {
    playerId,
    itemId: parsed.itemId,
    targetId: parsed.targetId,
  });

  log.info(`[Inventory] Player ${playerId} used item ${parsed.itemId}`);
}

export const inventoryHandlers: HandlerRegistry = {
  INVENTORY_ADD_ITEM: handleInventoryAddItem,
  EQUIP_WEAPON: ctx => equipToSlot(ctx, "weapon"),
  EQUIP_ARMOR: ctx => equipToSlot(ctx, "armor"),
  UNEQUIP_WEAPON: ctx => unequipSlot(ctx, "weapon"),
  UNEQUIP_ARMOR: ctx => unequipSlot(ctx, "armor"),
  USE_ITEM: handleUseItem,
};
