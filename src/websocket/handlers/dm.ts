import {
  npcSchema,
  eventSchema,
  npcUpdateHpSchema,
  npcApplyConditionSchema,
  npcRemoveConditionSchema,
  npcDeleteSchema,
  playerAwardXpSchema,
  playerLevelUpSchema,
  applyTemporaryHpSchema,
  applyBuffSchema,
  removeBuffSchema,
} from "../../../shared/index.js";
import { parsePayload, requireDM, requireGame } from "../guards.js";
import type { HandlerContext, HandlerRegistry } from "../types.js";

/** NPC_CREATE — add an NPC to the roster. */
function handleNPCCreate(ctx: HandlerContext): void {
  const engine = requireGame(ctx);
  if (!engine) return;

  const parsed = parsePayload(ctx, npcSchema);
  if (!parsed) return;

  engine.addNPC(parsed.name, parsed.description || "", parsed.role);
  ctx.manager.broadcastToGame(engine.id, "NPC_CREATED", {
    npc: engine.game.npcs[engine.game.npcs.length - 1],
  });
}

/** EVENT_CREATE — record a story beat in the chat log. */
function handleEventCreate(ctx: HandlerContext): void {
  const engine = requireGame(ctx);
  if (!engine) return;

  const parsed = parsePayload(ctx, eventSchema);
  if (!parsed) return;

  engine.addEvent(parsed.title, parsed.description || "");
  ctx.manager.broadcastToGame(engine.id, "EVENT_CREATED", {
    event: engine.game.chatHistory[engine.game.chatHistory.length - 1],
  });
}

/** NPC_UPDATE_HP — DM sets an NPC's current hit points. */
function handleNPCUpdateHP(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "update NPC HP");
  if (!resolved) return;

  const parsed = parsePayload(ctx, npcUpdateHpSchema);
  if (!parsed) return;

  resolved.engine.updateNPCHP(parsed.npcId, parsed.newHp);
  ctx.manager.broadcastToGame(resolved.engine.id, "DM_CONTROL_UPDATE", {
    action: "npc_update_hp",
    npcId: parsed.npcId,
    newHp: parsed.newHp,
    gameState: resolved.engine.game,
  });
  console.log(`[DM Control] Updated NPC ${parsed.npcId} HP to ${parsed.newHp}`);
}

/** NPC_APPLY_CONDITION — DM applies a status condition (poisoned, prone, ...). */
function handleNPCApplyCondition(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "apply conditions");
  if (!resolved) return;

  const parsed = parsePayload(ctx, npcApplyConditionSchema);
  if (!parsed) return;

  resolved.engine.applyConditionToNPC(parsed.npcId, parsed.condition);
  ctx.manager.broadcastToGame(resolved.engine.id, "DM_CONTROL_UPDATE", {
    action: "npc_apply_condition",
    npcId: parsed.npcId,
    condition: parsed.condition,
    gameState: resolved.engine.game,
  });
  console.log(`[DM Control] Applied condition ${parsed.condition} to NPC ${parsed.npcId}`);
}

/** NPC_REMOVE_CONDITION — DM clears a status condition. */
function handleNPCRemoveCondition(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "remove conditions");
  if (!resolved) return;

  const parsed = parsePayload(ctx, npcRemoveConditionSchema);
  if (!parsed) return;

  resolved.engine.removeConditionFromNPC(parsed.npcId, parsed.condition);
  ctx.manager.broadcastToGame(resolved.engine.id, "DM_CONTROL_UPDATE", {
    action: "npc_remove_condition",
    npcId: parsed.npcId,
    condition: parsed.condition,
    gameState: resolved.engine.game,
  });
  console.log(`[DM Control] Removed condition ${parsed.condition} from NPC ${parsed.npcId}`);
}

/** NPC_DELETE — DM removes an NPC from the game. */
function handleNPCDelete(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "delete NPCs");
  if (!resolved) return;

  const parsed = parsePayload(ctx, npcDeleteSchema);
  if (!parsed) return;

  resolved.engine.deleteNPC(parsed.npcId);
  ctx.manager.broadcastToGame(resolved.engine.id, "DM_CONTROL_UPDATE", {
    action: "npc_delete",
    npcId: parsed.npcId,
    gameState: resolved.engine.game,
  });
  console.log(`[DM Control] Deleted NPC ${parsed.npcId}`);
}

/** PLAYER_AWARD_XP — DM grants experience points. */
function handlePlayerAwardXP(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "award XP");
  if (!resolved) return;

  const parsed = parsePayload(ctx, playerAwardXpSchema);
  if (!parsed) return;

  resolved.engine.awardXPToPlayer(parsed.playerId, parsed.amount);
  ctx.manager.broadcastToGame(resolved.engine.id, "DM_CONTROL_UPDATE", {
    action: "player_award_xp",
    playerId: parsed.playerId,
    amount: parsed.amount,
    gameState: resolved.engine.game,
  });
  console.log(`[DM Control] Awarded ${parsed.amount} XP to player ${parsed.playerId}`);
}

/** PLAYER_LEVEL_UP — DM advances a player one level. */
function handlePlayerLevelUp(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "level up players");
  if (!resolved) return;

  const parsed = parsePayload(ctx, playerLevelUpSchema);
  if (!parsed) return;

  resolved.engine.levelUpPlayer(parsed.playerId);
  ctx.manager.broadcastToGame(resolved.engine.id, "DM_CONTROL_UPDATE", {
    action: "player_level_up",
    playerId: parsed.playerId,
    gameState: resolved.engine.game,
  });
  console.log(`[DM Control] Leveled up player ${parsed.playerId}`);
}

/** APPLY_TEMPORARY_HP — DM grants temporary hit points for a number of rounds. */
function handleApplyTemporaryHP(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "apply temporary HP");
  if (!resolved) return;

  const parsed = parsePayload(ctx, applyTemporaryHpSchema);
  if (!parsed) return;

  const { targetId, isPlayer, amount, duration } = parsed;
  resolved.engine.applyTemporaryHP(targetId, isPlayer, amount, duration);
  ctx.manager.broadcastToGame(resolved.engine.id, "BUFF_UPDATE", {
    action: "apply_temporary_hp",
    targetId,
    isPlayer,
    amount,
    duration,
  });
  console.log(`[Buff] Applied ${amount} temporary HP to ${targetId} for ${duration} rounds`);
}

/** APPLY_BUFF — DM attaches a named buff/debuff with a round duration. */
function handleApplyBuff(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "apply buffs");
  if (!resolved) return;

  const parsed = parsePayload(ctx, applyBuffSchema);
  if (!parsed) return;

  const { targetId, isPlayer, buff } = parsed;
  resolved.engine.applyBuff(targetId, isPlayer, buff);
  ctx.manager.broadcastToGame(resolved.engine.id, "BUFF_UPDATE", {
    action: "apply_buff",
    targetId,
    isPlayer,
    buff,
  });
  console.log(`[Buff] Applied ${buff.name} to ${targetId} for ${buff.duration} rounds`);
}

/** REMOVE_BUFF — DM strips a named buff/debuff. */
function handleRemoveBuff(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "remove buffs");
  if (!resolved) return;

  const parsed = parsePayload(ctx, removeBuffSchema);
  if (!parsed) return;

  const { targetId, isPlayer, buffName } = parsed;
  resolved.engine.removeBuff(targetId, isPlayer, buffName);
  ctx.manager.broadcastToGame(resolved.engine.id, "BUFF_UPDATE", {
    action: "remove_buff",
    targetId,
    isPlayer,
    buffName,
  });
  console.log(`[Buff] Removed ${buffName} from ${targetId}`);
}

export const dmHandlers: HandlerRegistry = {
  NPC_CREATE: handleNPCCreate,
  EVENT_CREATE: handleEventCreate,
  NPC_UPDATE_HP: handleNPCUpdateHP,
  NPC_APPLY_CONDITION: handleNPCApplyCondition,
  NPC_REMOVE_CONDITION: handleNPCRemoveCondition,
  NPC_DELETE: handleNPCDelete,
  PLAYER_AWARD_XP: handlePlayerAwardXP,
  PLAYER_LEVEL_UP: handlePlayerLevelUp,
  APPLY_TEMPORARY_HP: handleApplyTemporaryHP,
  APPLY_BUFF: handleApplyBuff,
  REMOVE_BUFF: handleRemoveBuff,
};
