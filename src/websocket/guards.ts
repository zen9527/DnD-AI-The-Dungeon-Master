import type { ZodType } from "zod";
import { gameStore } from "../game/store.js";
import type { GameEngine } from "../game/engine.js";
import type { Player } from "../types/index.js";
import type { HandlerContext } from "./types.js";

/**
 * Guards for the repeated preamble every WebSocket handler needs:
 * "is this client in a game", "does the game exist", "is this player the DM",
 * "does the payload validate". Each returns `null` after sending an ERROR frame,
 * so handlers read as `const x = requireX(ctx); if (!x) return;`.
 */

/** Resolve the engine for the client's current game. */
export function requireGame(ctx: HandlerContext): GameEngine | null {
  if (!ctx.client.gameId) {
    ctx.manager.sendError(ctx.ws, "Not in a game");
    return null;
  }
  const engine = gameStore.getGame(ctx.client.gameId);
  if (!engine) {
    ctx.manager.sendError(ctx.ws, "Game not found");
    return null;
  }
  return engine;
}

/** Resolve the engine plus the acting player, requiring both to exist. */
export function requirePlayer(ctx: HandlerContext): { engine: GameEngine; player: Player } | null {
  if (!ctx.client.gameId || !ctx.client.playerId) {
    ctx.manager.sendError(ctx.ws, "Not in a game");
    return null;
  }
  const engine = gameStore.getGame(ctx.client.gameId);
  if (!engine) {
    ctx.manager.sendError(ctx.ws, "Game not found");
    return null;
  }
  const player = engine.game.players.find(p => p.id === ctx.client.playerId);
  if (!player) {
    ctx.manager.sendError(ctx.ws, "Player not found");
    return null;
  }
  return { engine, player };
}

/**
 * Like `requirePlayer`, but rejects non-DM callers.
 * `action` completes the sentence "Only the DM can ..." (e.g. "start combat").
 */
export function requireDM(ctx: HandlerContext, action: string): { engine: GameEngine; player: Player } | null {
  if (!ctx.client.gameId || !ctx.client.playerId) {
    ctx.manager.sendError(ctx.ws, "Not in a game");
    return null;
  }
  const engine = gameStore.getGame(ctx.client.gameId);
  if (!engine) {
    ctx.manager.sendError(ctx.ws, "Game not found");
    return null;
  }
  const player = engine.game.players.find(p => p.id === ctx.client.playerId);
  if (!player?.isDM) {
    ctx.manager.sendError(ctx.ws, `Only the DM can ${action}`);
    return null;
  }
  return { engine, player };
}

/** Validate the inbound payload, reporting every Zod issue in one ERROR frame. */
export function parsePayload<T>(ctx: HandlerContext, schema: ZodType<T>, source?: unknown): T | null {
  const result = schema.safeParse(source ?? ctx.payload);
  if (!result.success) {
    ctx.manager.sendError(ctx.ws, result.error.issues.map(i => i.message).join("; "));
    return null;
  }
  return result.data;
}
