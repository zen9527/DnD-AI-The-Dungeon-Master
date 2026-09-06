import { log } from "../../utils/logger.js";
import { rollDice, calculateTotal } from "../../game/dice.js";
import { combatStartSchema, initiativeRollSchema, diceRollSchema } from "../../../shared/index.js";
import { parsePayload, requireDM, requirePlayer } from "../guards.js";
import type { HandlerContext, HandlerRegistry } from "../types.js";
import type { GameEngine } from "../../game/engine.js";
import type { ManagerApi } from "../types.js";

/** Combat state is always broadcast as a whole so clients never reconcile deltas. */
function broadcastCombatState(manager: ManagerApi, engine: GameEngine): void {
  manager.broadcastToGame(engine.id, "COMBAT_STATE", {
    combatMode: engine.combatMode,
    initiativeOrder: engine.initiativeOrder,
    currentRound: engine.currentRound,
    currentTurnIndex: engine.currentTurnIndex,
    currentPlayerName: engine.getCurrentPlayer()?.characterName,
  });
}

/** COMBAT_START — roll initiative and switch the game into combat mode. */
function handleCombatStart(ctx: HandlerContext): void {
  const parsed = parsePayload(ctx, combatStartSchema);
  if (!parsed) return;

  const resolved = requireDM(ctx, "start combat");
  if (!resolved) return;

  resolved.engine.startCombat(parsed.startInitiative ?? true);
  broadcastCombatState(ctx.manager, resolved.engine);
  log.info(`[Combat] Combat started in game ${resolved.engine.id}`);
}

/** COMBAT_END — leave combat mode and clear the initiative order. */
function handleCombatEnd(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "end combat");
  if (!resolved) return;

  resolved.engine.endCombat();
  broadcastCombatState(ctx.manager, resolved.engine);
  log.info(`[Combat] Combat ended in game ${resolved.engine.id}`);
}

/** INITIATIVE_ROLL — the DM rolls initiative for one player or NPC. */
function handleInitiativeRoll(ctx: HandlerContext): void {
  const parsed = parsePayload(ctx, initiativeRollSchema);
  if (!parsed) return;

  const resolved = requireDM(ctx, "roll initiative");
  if (!resolved) return;

  const score = resolved.engine.rollIndividualInitiative(parsed.entityId, parsed.isPlayer);

  ctx.manager.broadcastToGame(resolved.engine.id, "INITIATIVE_UPDATE", {
    initiativeOrder: resolved.engine.initiativeOrder,
    newEntry: { entityId: parsed.entityId, score },
  });

  log.info(`[Initiative] ${parsed.isPlayer ? "Player" : "NPC"} ${parsed.entityId} rolled ${score}`);
}

/** TURN_ADVANCE — the DM manually hands the turn to the next combatant. */
function handleTurnAdvance(ctx: HandlerContext): void {
  const resolved = requireDM(ctx, "advance turns");
  if (!resolved) return;

  resolved.engine.advanceTurn();
  broadcastCombatState(ctx.manager, resolved.engine);
  log.info(`[Combat] Turn advanced in game ${resolved.engine.id}`);
}

/** DICE_ROLL — rolled server-side so clients cannot fabricate results. */
function handleDiceRoll(ctx: HandlerContext): void {
  const resolved = requirePlayer(ctx);
  if (!resolved) return;
  const { engine, player } = resolved;

  const parsed = parsePayload(ctx, diceRollSchema);
  if (!parsed) return;

  const { diceType, count, modifier = 0 } = parsed;
  const rolls = rollDice(diceType, count);

  ctx.manager.broadcastToGame(engine.id, "DICE_ROLL_RESULT", {
    result: {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      playerId: player.id,
      playerName: player.name,
      characterName: player.characterName,
      diceType,
      count,
      rolls,
      modifier,
      total: calculateTotal(rolls, modifier),
      timestamp: Date.now(),
    },
  });
}

export const combatHandlers: HandlerRegistry = {
  COMBAT_START: handleCombatStart,
  COMBAT_END: handleCombatEnd,
  INITIATIVE_ROLL: handleInitiativeRoll,
  TURN_ADVANCE: handleTurnAdvance,
  DICE_ROLL: handleDiceRoll,
};
